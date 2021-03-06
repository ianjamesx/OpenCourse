//import * as db from './queries';
import verify = require('../../utils/verify');       //validator wrapper
import { vals, keys, tablekeys } from '../../utils/utils';      //some utils for restructuring data
import * as db from '../../db/dbquery';
import moment = require('moment');

import { User } from '../User/User';
import { Question } from '../Question/Question';
import { Course } from '../Course/Course';

interface DBResult {
    error?: string;
    data?: any;
}

interface Errors {
    name?: string;
    prompt?: string;
    attempts?: string;
    latepenalty?: string;
    points?: string;
    dates?: string;
}

interface AnswerAttempt {
    correct?: boolean;
    attempts?: number;
    id?: number;
    hint?: string
    score?: number;
    answer?: string;
}

interface Score {
    total?: number;
    actual?: number;
    percent?: number;
}


class Assignment {

    //name, category, ids of author/course
    protected name: string;
    protected author: number;
    protected course: number;
    protected category: string; //category (e.g. lab, hw)
    protected prompt: string; //prompt for assignment (e.g 'this test is...')
    protected type: string;
    
    protected attempts: number;
    protected randomize: number;
    protected latepenalty: number;
    protected points: number;

    //dates for assignment
    protected open: string;
    protected close: string;
    protected cutoff: string;

    protected id: number;

    //if user decides to append questions, allow a question attribute
    protected questions: Question[];

    public table: string = `assignments`;

    constructor(data?: any){
        if(data) this.load(data);
    }

    public load(data?: any){
        this.name = data.name;
        this.author = data.author;
        this.course = data.course;
        this.prompt = data.prompt;
        
        this.attempts = data.attempts;
        this.randomize = data.randomize;
        this.latepenalty = data.latepenalty;
        this.points = data.points;

        this.open = data.open;
        this.close = data.close;
        this.cutoff = data.cutoff;

        this.category = data.category;
        this.type = data.type;

        this.id = data.id;
    }

    public async loadFromID(ID: number): Promise<string | void> {
        this.id = ID;
        let result: DBResult = await db.load(this);

        if(result.error)
            return result.error;

        this.load(result.data);
    }

    public async save(): Promise<any | void> {
        let errs: Errors = {};
        errs = await this.verify();   
        if(errs)
            return errs;

        if(!this.id)
            await this.generateID();

        let dberr: DBResult = await db.save(this);
        if(dberr.error)
            return { any: dberr.error };
    }

    protected async verify(): Promise<any | null> {

        let errs: Errors = {
            name: verify.title(this.name),
            attempts: verify.range(this.attempts, 0, 9999),
            points: verify.range(this.points, 0, 9999),
            latepenalty: verify.range(this.latepenalty, 0, this.points),
            dates: verify.dateorder([this.open, this.close, this.cutoff], ['opening', 'closing', 'cutoff'])
        };
      
        return verify.anyerrors(errs);

    }

    protected async generateID(): Promise<void> {
        this.id = await db.generateID(`questions`);
    }

    public getID(): number {
        return this.id;
    }

    /*
    create records of progress for all questions for each student for this assignment
    for each question, for each user in course
    */
    public async initStudentRecords(questionIDs: string[]): Promise<void> {

        let i: any, j: any;

        let course: Course = new Course();
        course.loadByID(this.course);
        let students: any[] = await course.getEnrollees();

        let records = [];

        for(i = 0; i < questionIDs.length; i++){
            for(j = 0; j < students.length; j++){

                records.push([
                    this.id,
                    Number(questionIDs[i]), //cast question id to number
                    students[j].id,
                    0,
                    this.attempts
                ]);

            }
            
        }

        let savequery = db.format(`INSERT INTO assignmentprogress (assignment, question, user, correct, attempts) VALUES ?`, [records]);
        await db.dbquery(savequery);

    }

    //add progress records for specific student (usually for when a student joins class after assignment already posted)
    public async addNewStudentRecords(userID: number): Promise<void> {

        let questions: number[] = await this.getQuestionIDs();
        let i;
        let progress = [];

        for(i = 0; i < questions.length; i++){
            progress.push([
                this.id,
                Number(questions[i]),
                userID,
                0,
                this.attempts
            ])
        }

        let savequery = db.format(`INSERT INTO assignmentprogress (assignment, question, user, correct, attempts) VALUES ? `, [progress]);
        await db.dbquery(savequery);
        
    }

    //determine if this assignment is coming up this week
    public isUpcoming(): boolean {
        let weeklater: any = new Date(Date.now());
        let msinday: number = 86400000; //around this many ms in one day
        let weekms: number = weeklater.getTime() + (msinday * 7); //get ms date one week ahead

        let closedate: any = new Date(this.close);
        if(weekms > closedate.getTime() && Date.now() < closedate.getTime()){ //if date is within a week, and hasent closed yet
            return true;
        }
        return false;
    }

    public async getQuestionIDs(): Promise<number[]> {
        let selectquery = db.format(`SELECT q.id FROM questions AS q, assignmentquestions AS aq WHERE aq.question = q.id AND aq.assignment = ?`, [this.getID()]);
        let result: DBResult = await db.dbquery(selectquery);

        if(result.error){
            return [];
        }

        let ids: number[] = [];
        let i;
        for(i = 0; i < result.data.length; i++){
            ids.push(result.data[i].id);
        }

        return ids;

    }

    public async saveQuestions(questionIDs: string[]): Promise<void> {

        //to perform bulk insert, we must add id of assignment to each element (and cast question ids to numbers)
        let i: number;
        let questionnest = [];
        for(i = 0; i < questionIDs.length; i++){
            questionnest[i] = [this.getID(), Number(questionIDs[i])];
        }

        let savequery = db.format(`INSERT INTO assignmentquestions (assignment, question) VALUES ?`, [questionnest]);
        let result: DBResult = await db.dbquery(savequery);

        //also have to save question records for students
        this.initStudentRecords(questionIDs);
    }

    /*
    get all question/answers for this assignment
    */
    public async getQuestions(): Promise<any[]> {

        let queryraw = `SELECT q.body, q.hint, q.type, q.id AS questID, a.id AS ansID, a.correct, a.ans 
                        FROM questions AS q, answers AS a, assignmentquestions AS aq 
                        WHERE aq.assignment = ? AND q.id = aq.question AND a.question = q.id`;
        let loadquery = db.format(queryraw, [this.getID()]);

        let result: DBResult = await db.dbquery(loadquery);

        if(result.error){
            return [];
        }

        //reform questions (to eliminate duplicates for answers)
        let quests: any = this.reformQuestionData(result);
        
        let i: any;
        let questions: Question[] = [];

        for(i in quests){
            questions.push(new Question(quests[i]));
        }

        //then, get the assignment view of each question
        for(i = 0; i < questions.length; i++){
            questions[i] = questions[i].assignmentView();
        }

        return questions;

    }

    protected reformQuestionData(result: any): any {

        let i: number;
        let quests: any = {};
        for(i = 0; i < result.data.length; i++){

            //save question (if not already saved) as object
            let currquestionID: number = result.data[i].questID;
            if(!quests[currquestionID]){
                quests[currquestionID] = {
                    body: result.data[i].body,
                    hint: result.data[i].hint,
                    type: result.data[i].type,
                    id: result.data[i].questID,
                    answers: []
                };

                //save current answer as well
                quests[currquestionID].answers.push({
                    answer: result.data[i].ans,
                    correct: result.data[i].correct,
                    id: result.data[i].ansID
                });
                
            } else {

                quests[currquestionID].answers.push({
                    answer: result.data[i].ans,
                    correct: result.data[i].correct,
                    id: result.data[i].ansID
                });

            }
        }

        return quests;

    }

    //remove question (and progress records) from an assignment
    public async removeQuestion(questionID: number): Promise<void> {
        let deletequery: string = db.format(`DELETE FROM assignmentquestions WHERE question = ? AND assignment = ?`, [questionID, this.getID()]);
        let deleteprogress: string = db.format(`DELETE FROM assignmentprogress WHERE question = ? AND assignment = ?`, [questionID, this.getID()]);
        await db.dbquery(deletequery);
        await db.dbquery(deleteprogress);
    }

    //given a list of questions, remove any that exist currently in assignment
    public async removeQuestionsIfExists(questions: any[]): Promise<void> {
        let selectquery: string = db.format(`SELECT question FROM assignmentquestions WHERE assignment = ?`, [this.getID()]);
        let result: DBResult = await db.dbquery(selectquery);

        let curr: any = result.data;
        let i: number, j: number;

        for(i = 0; i < curr.length; i++){
          for(j = 0; j < questions.length; j++){
            if(curr[i].question == questions[j].id){
              questions.splice(j, 1);
            }
          }
        }
    }

    //student tries to answer a single question
    public async answerQuestion(questionID: number, userID: number, answer: string): Promise<AnswerAttempt> {

        //if this assignment is passed cutoff date, dont do anything
        if(this.passCutoff()) return {};

        //question we will be loading
        let question: Question = new Question();
        await question.loadByID(questionID);

        let checkquery = db.format(`SELECT correct FROM answers WHERE question = ? AND ans = ?`, [questionID, answer]);
        let result: DBResult = await db.dbquery(checkquery);

        if(result.error) return {correct: false, hint: db.unknownerr};
        if(result.data.length == 0) return {correct: false, hint: db.unknownerr};

        let iscorrect = result.data[0].correct;
        let response: AnswerAttempt = {};
        response.id = questionID;

        if(iscorrect == 1){
            response.correct = true;
        }

        //if student answers incorrectly, load question hint
        if(iscorrect == 0){
            response.correct = false;
            response.hint = question.getHint();
        }

        //use an attempt and update progress if correct
        await this.useQuestionAttempt(questionID, userID, iscorrect);

        //get the number of attempts they have left as well
        let resp: any = await this.getQuestionProgress(userID, questionID);
        response.attempts = resp.attempts;
        response.score = await this.getStudentScore(userID);

        //if no more attempts, or answer is correct, show student the answer
        if(response.attempts == 0 || iscorrect){
            response.answer = await question.getCorrectAnswer();
        }

        return response;

    }

    //update attempts on a specific question (for homework assignments)
    public async useQuestionAttempt(questionID: number, userID: number, correct: number): Promise<void> {

        let update = `UPDATE assignmentprogress SET attempts = GREATEST(0, attempts - 1), correct = ? WHERE question = ? AND user = ? AND assignment = ?`;

        let updatequery = db.format(update, [correct, questionID, userID, this.getID()]);
        await db.dbquery(updatequery);

    }

    //update all attempts (for questions on assignment)
    public async useAssignmentAttempts(userID: number): Promise<void> {
        let updatequery = db.format(`UPDATE assignmentprogress SET attempts = GREATEST(0, attempts - 1) WHERE user = ? AND assignment = ?`, [userID, this.getID()]);
        await db.dbquery(updatequery);
    }

    //get all progress records for all questions user has on this assignment
    public async getStudentProgress(userID: number): Promise<AnswerAttempt[]> {

        let select = `SELECT correct, attempts, question FROM assignmentprogress WHERE user = ? AND assignment = ?`;
        let selectquery: string = db.format(select, [userID, this.getID()]);
        let result: DBResult = await db.dbquery(selectquery);

        if(result.error) return [];

        //if we're passed cutoff, take away attempts (to render assignment unanswerable)
        let i: number;
        if(this.passCutoff()){
            for(i = 0; i < result.data.length; i++){
                result.data[i].attempts = 0;
            }
        }

        let progress: AnswerAttempt[] = [];
        for(i = 0; i < result.data.length; i++){
            progress.push({
                correct: result.data[i].correct,
                attempts: result.data[i].attempts,
                id: result.data[i].question
            })
        }

        return progress;

    }

    /*
    see if assignment is passed closing date or cutoff date
    */

    public passCutoff(): boolean {
        let cutoff: Date = new Date(this.cutoff);
        if(cutoff.getTime() < Date.now()){
            return true;
        }
        return false;
    }

    public passDue(): boolean {
        let close: Date = new Date(this.close);
        if(close.getTime() < Date.now()){
            return true;
        }
        return false;
    }

    //get progress record for just one question
    public async getQuestionProgress(userID: number, questionID: number): Promise<AnswerAttempt> {
        
        let select = `SELECT correct, attempts FROM assignmentprogress WHERE question = ? AND user = ? AND assignment = ?`;
        let selectquery = db.format(select, [questionID, userID, this.getID()]);
        let result: DBResult = await db.dbquery(selectquery);
        if(result.error || result.data.length == 0) return {};

        let progress: AnswerAttempt = {
            correct: result.data[0].correct,
            attempts: result.data[0].attempts,
            id: questionID
        }

        return progress;
    }

    public async getStudentScore(userID: number): Promise<number> {
        let progress: AnswerAttempt[] = await this.getStudentProgress(userID);

        let correctanswers: number = 0;

        let i: number;
        for(i = 0; i < progress.length; i++){
            if(progress[i].correct){
                correctanswers++;
            }
        }

        let score = (correctanswers / progress.length) * 100;
        score = Math.floor(score);
        return score;

    }

    public static async appendStudentScores(userID: number, assigns: Assignment[]): Promise<any> {

        let i: number;
        let assignviews = [];
        for(i = 0; i < assigns.length; i++){
            let assignscore: number = await assigns[i].getStudentScore(userID);
            let assigndata = await assigns[i].dataView();

            //if there is no score for this assignment, set to 0
            if(isNaN(assignscore)) assignscore = 0;

            assigndata.score = assignscore;
            assignviews.push(assigndata);

        }

        return assignviews;

    }

    public setID(id: number){
        this.id = id;
    }

    public getDueDate(){
        return this.close;
    }

    public getColumns(): any{
        
        return {
            name: this.name,
            author: this.author,
            course: this.course,
            category: this.category,
            type: this.type,
            prompt: this.prompt,
            attempts: this.attempts,
            randomize: this.randomize,
            latepenalty: this.latepenalty,
            points: this.points,
            open: this.open,
            close: this.close,
            cutoff: this.cutoff,
            id: this.id
        };
    }

    public async dataView(): Promise<any> {

        //get instructors first, last name from id
        let author: User = new User();
        await author.loadFromID(this.author);
        let authorname: string = author.getFN() + ' ' + author.getLN();

        //also get readable name for course

        let course: Course = new Course();
        await course.loadByID(this.course);
        let coursename = course.getNameFormatted();

        return {
            name: this.name,
            author: authorname,
            course: coursename,
            category: this.category,
            type: this.type,
            prompt: this.prompt,
            attempts: this.attempts,
            randomize: this.randomize,
            latepenalty: this.latepenalty,
            points: this.points,
            open: moment(this.open).format("dddd, MMMM Do YYYY, h:mm a"),
            close: moment(this.close).format("dddd, MMMM Do YYYY, h:mm a"),
            cutoff: moment(this.cutoff).format("dddd, MMMM Do YYYY, h:mm a"),
            openms: new Date(this.open).getTime(),
            closems: new Date(this.close).getTime(),
            cutoffms: new Date(this.cutoff).getTime(),
            id: this.id
        };

    }

}

export {
    Assignment,
    AnswerAttempt,
    DBResult
}
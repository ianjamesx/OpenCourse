//import * as db from './queries';
import verify = require('../../utils/verify');       //validator wrapper
import { vals, keys } from '../../utils/utils';      //some utils for restructuring data
import * as db from '../../db/dbquery';
import { DBResult } from '../../interfaces';

import { User } from '../User/User';

interface Answer {
    answer: string;
    correct: number;
}

interface Errors {
    question?: string;
    hint?: string;
    answer?: string;
}

class Question {

    private body: string;
    private answers: Answer[];
    private hint: string;

    private author: number;
    private type: string;
    private ispublic: number;

    private id: number;

    public table:string = `questions`;

    
    constructor(data?: any){
        if(data) this.load(data);
    }

    public load(data?: any){
        this.body = data.body;
        this.answers = data.answers;
        this.hint = data.hint;
        this.author = data.author;
        this.type = data.type;
        this.ispublic = data.ispublic;
        this.id = data.id;
    }

    public async loadByID(ID: number): Promise<string | void> {
        this.id = ID;
        let result: DBResult = await db.load(this);

        if(result.error)
            return result.error;

        //also load answers
        await this.loadAnswers();
        result.data.answers = this.answers;

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

        //also save answers seperately
        let anserr: DBResult = await this.saveAnswers();
        if(anserr.error)
            return { any: dberr.error };
    }

    public async saveAnswers(): Promise<DBResult>{

        //to perform a bulk insert, we have to turn array of objects into nested array first
        let i: number;
        let answernest: any = [];
        let answers = this.answers;

        for(i = 0; i < answers.length; i++){

            let curr: any[] = vals(answers[i]);
            curr.push(this.id);                         //also push id of this question
            curr.push(await db.generateID(`answers`)); //and id generated for this answer
            
            answernest.push(curr);

        }

        let savequery = db.format(`INSERT INTO answers (ans, correct, question, id) VALUES ?`, [answernest]);

        let result: DBResult = await db.dbquery(savequery);
        return result;
    }

    
    private async verify(): Promise<any | null> {

        let errs: Errors = {
            question: verify.custom(this.body, 'question')
        };
      
        return verify.anyerrors(errs);
    }

    private async generateID(): Promise<void> {
        this.id = await db.generateID(`questions`);
    }

    public getID(): number {
        return this.id;
    }

    public getAnswers(): any {
        return this.answers;
    }

    public async loadAnswers(): Promise<void> {

        let loadquery: string = db.format(`SELECT id, correct, ans FROM answers WHERE question = ?`, this.getID());
        let result: DBResult = await db.dbquery(loadquery);
        this.answers = result.data;

    }

    /*
    see if this question contains any of the keywords entered by user
    count how many keywords entered match question body
    will be sorted and displayed to user
    */
    public containsKeywords(keywords: string[]): number {

        let keywordCount: number = 0;
        let i: number;

        //count how many keywords entered appear in this question
        for(i = 0; i < keywords.length; i++){
            if(this.body.includes(keywords[i])){
                keywordCount++;
            }
        }

        return keywordCount;

    }

    /*
    get all questions by a specific author
    */
    public static async allQuestionsBy(userID: number): Promise<any[]>{

        let question: Question = new Question();
        let searchquery: string = db.format(`SELECT ?? FROM questions WHERE author = ?`, [keys(question.getColumns()), userID]);

        let result: DBResult = await db.dbquery(searchquery);

        //on error, return empty array of questions
        if(result.error) return [];
        return result.data;

    }

    /*
    get questions by criteria
    */
    public checkQuestionsForKeywords(): any {

    }

    /*
    get all questions that are public
    */
    public static async allPublicQuestions(): Promise<any[]> {

        let question: Question = new Question();
        let searchquery: string = db.format(`SELECT ?? FROM questions WHERE public = 1`,  [keys(question.getColumns())]);

        let result: DBResult = await db.dbquery(searchquery);

        //on error, return empty array of questions
        if(result.error) return [];
        return result.data;

    }

    public async getCorrectAnswer(): Promise<string> {
        
        let searchquery: string = db.format(`SELECT ans FROM answers WHERE correct = 1 AND question = ?`, [this.getID()]);
        let result: DBResult = await db.dbquery(searchquery);

        if(result.error || !result.data.length){
            return db.unknownerr;
        }

        return result.data[0].ans;
    }

    public getColumns(): any {

        //dont return answers in column data
        //we'll return that in a seperate function to save

        return {
            body: this.body,
            hint: this.hint,
            author: this.author,
            type: this.type,
            public: this.ispublic,
            id: this.id
        }
    }

    public answerData(): any {
        
        //some sample data of what an answer would contain
        return {
            type: 0,
            id: 0,
            ans: 0
        }
    }

    public getHint(){
        return this.hint;
    }

    public async dataView(): Promise<any> {

        //get instructors first, last name from id
        let author: User = new User;
        await author.loadFromID(this.author);
        let authorname: string = author.getFN() + ' ' + author.getLN();

        return {
            body: this.body,
            hint: this.hint,
            author: authorname,
            type: this.type,
            public: this.ispublic,
            id: this.id,
            answers: this.answers
        }

    }

    //call this view to avoid overhead of getting author name for question (when viewing in assignment)
    public assignmentView(): any {

        return {
            body: this.body,
            hint: this.hint,
            type: this.type,
            id: this.id,
            answers: this.answers
        }

    }
    

}

export {
    Question,
    DBResult
}
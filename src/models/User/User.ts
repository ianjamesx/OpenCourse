//import * as db from './queries';
import * as db from '../../db/dbquery';
import verify = require('../../utils/verify');       //validator wrapper
import { vals, keys } from '../../utils/utils';      //some utils for restructuring data
import { hash as generatehash, compare } from 'bcrypt';    //password encryption
import { DBResult } from '../../interfaces';

import { Course } from '../Course/Course';
import { Assignment } from '../Assignment/Assignment';

/*
interfaces for this class
*/

//user input errors when making this class
interface Errors {
  email?: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  any?: string; //<-- errors when inserting into db, not based on user input
}

interface Credentials {
  email: string;
  password: string;
}

interface UserSession {
  id: number;
}

class User {

  protected email: string;
  protected password: string;
  protected firstname: string;
  protected lastname: string;
  protected instructor: number;
  protected hash: string; //hashed password
  protected id: number;

  public static table = `users`;

  constructor(email?:string, password?:string, firstname?:string, lastname?:string, instructor?: number){
    this.email = email;
    this.password = password;
    this.firstname = firstname;
    this.lastname = lastname;
    this.instructor = instructor;
  }

  /*

  user session interaction, either loading user data from session (which contain User ID) or loading User ID to session

  */

  public getIDFromSession(session: any): number {
    if(!session.user){
      return null;
    }
    return session.user.id;
  }

  //load user from an id stored in session
  public async sessionLoad(session: any): Promise<string | void> {
    
    if(!session.user) return 'Error: user has no session'; //<-- this error never displayed to client, they only get a 404
    return await this.loadFromID(session.user.id);

  }

  public async loadFromID(id: number): Promise<string | void> {

    this.id = id;
    let result: DBResult = await db.load(this);

    if(result.error) return result.error; //error here most likely caused by user having no active session
    this.loadtouser(result.data);

  }

  public setSession(session: any): void {
    let sess: UserSession = {
      id: this.getID()
    };

    session.user = sess;
  }

  public loadtouser(data: any){
    this.email = data.email;
    this.firstname = data.firstname;
    this.lastname = data.lastname;
    this.id = data.id;
    this.instructor = data.instructor;
  }

  /*

  saving/verification of user inputted data

  */

  private async verify(): Promise<any | null> {
    
    let errs: Errors = {
      email: await verify.emailinuse(this.email),
      firstname: verify.name(this.firstname),
      lastname: verify.name(this.lastname),
      password: verify.password(this.password)
    };

    return verify.anyerrors(errs);

  }

  public async save(): Promise<Errors | void> {

    let errs: Errors = {};
    errs = await this.verify(); //first, see if we have any errors in user inputted data
    if(errs)
      return errs;
    
    if(!this.hash) await this.encryptPassword(); //if we dont have a hash, get it from current password
    if(!this.id) await this.generateID();        //if we dont have an ID either, generate one

    let dberr: DBResult = await db.save(this); //save in db, return any db errors or null if no errs
    if(dberr.error)
      return { any: dberr.error };
  }

  public async login(req: any): Promise<string | void> {

    //build query to search by email only (we'll compare to password later)
    let loginquery: string = db.format(`SELECT ?? FROM ${User.table} WHERE email = ?`, [keys(this.getColumns()), this.email]);
    let result: DBResult = await db.dbquery(loginquery);

    if(result.error) return result.error;

    //select first entry
    result.data = result.data[0];

    console.log(result.data);

    //if no users found from email, return a login error message
    if(!result.data){
      return `Email or password incorrect`;
    }

    //if we found a user, compare the encrypted password to the one entered
    let passwordmatched: boolean = await compare(this.password, result.data.password); //compare users password to hash in db
    if(!passwordmatched) return `Email or password incorrect`;

    //save data to this object and to session
    this.loadtouser(result.data);
    this.setSession(req);
  }

  /*
  ID generation/password encryption
  */

  private async generateID(): Promise<void> {
    this.id = await db.generateID(User.table);
  }

  private async encryptPassword(): Promise<void> {
    let saltRounds: number = 5;
    this.hash = await generatehash(this.password, saltRounds);
  }

  /*
  for getting course content
  */

  public async getAllCourses(): Promise<DBResult> {

    let course: Course = new Course();
    let coursequery = db.format(`SELECT ?? FROM courses WHERE id IN (SELECT course FROM usercourse WHERE user = ?)`, [keys(course.getColumns()), this.id]);

    let coursedata: DBResult = await db.dbquery(coursequery);
    return coursedata;
    
  }

  /*
  for getting assignments for this user
  */
  public async getAllAssignments(): Promise<DBResult> {

    let assignment: Assignment = new Assignment();
    let assignmentquery = db.format(`SELECT ?? FROM assignments WHERE course IN (SELECT course FROM usercourse WHERE user = ?)`, [keys(assignment.getColumns()), this.id]);

    let assignmentdata: DBResult = await db.dbquery(assignmentquery);
    return assignmentdata;
  }

  /*

  general getters, for db inserts, or interfaces

  */

  public getColumns(): any {

    return {
      email: this.email,
      password: this.hash, //when retrieving password to store, only retrieve hash
      firstname: this.firstname,
      lastname: this.lastname,
      instructor: this.instructor ? 1 : 0,
      id: this.id
    };

  }

  public dataView(): any {

    return {
      email: this.email,
      firstname: this.firstname,
      lastname: this.lastname,
      instructor: this.instructor ? 1 : 0,
      id: this.id
    };

  }

  public getFN(): string {
    return this.firstname;
  }

  public getLN(): string {
    return this.lastname;
  }

  public getID(): number {
    return this.id;
  }

  //determine if instructor or not
  public isInstructor(): number {
    return this.instructor;
  }

  public credentials(): any { //login credentials
    let creds: Credentials = {
      email: this.email,
      password: this.password
    }
    return creds;
  }

};

export {
  User,
  DBResult,
  Credentials,
  UserSession
};

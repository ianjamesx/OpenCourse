/*
var hello = async () => {
  let promise = new Promise((resolve, reject) => {
    setTimeout(() => resolve("done!"), 1000)
  });

  let result = await promise; // wait until the promise resolves (*)
  console.log('promise:');
  console.log(result);
  return result;

  //console.log(result); // "done!"
};

var hello2 = async () => {
  return await hello();
};

var start = () => {
  hello2().then((result) => {
    //console.log(result);
  });
};

var valid = async () => {

  var verify = require('./verify');

  var errmsgs = await verify.all({
    email: ['hell@h2.com', 'email'],
    firsname: ['ian', 'name'],
    lastname: ['thomas', 'name'],
    password: ['1234Dgdf', 'password'],
  });

  return errmsgs;

};

start();
valid().then(console.log);
*/

/*

db.query('SELECT * FROM users').then(result => {

}).catch(err => {
  console.log("WE GOT AN ERR")
});

setTimeout(() => {
  console.log('------------------------');
  db.query('SELECT 1+1 AS result').then(result => {
    console.log(result.length);
  });
  db.query('SHOW TABLES').then(res => {
    console.log(res.length);
  });
}, 2000);*/

/*
import { saveCategories } from '../models/Course/queries';

let examp: any = {
  21312: {name: 'test', points: 12},
  95435: {name: 'hello', points: 53}
}

saveCategories(examp, 543341).then();*/
/*
import * as db from '../db/dbquery';
let arr: any[] = [[43,1], [64, 23]];
let savequery = db.format(`INSERT INTO course_categories (name, points, course) VALUES ?`, [arr]);
console.log(savequery);

*/

import { Course } from '../models/Course/Course';
import { Assignment } from '../models/Assignment/Assignment';
import { views } from './utils';
import { mergeOnId } from './utils';

//import { saveQuestionsFromJSON } from '../services/questionparser';


let fs = require('fs');
let path = require('path');

let test = async (): Promise<void> => {
/*
  let arr1: any = [{id: 1, a: 3}, {id: 2, a: 53}];
  let arr2: any = [{id: 1, b: 6}, {id: 2, b: 12}];

  console.log(mergeOnId(arr1, arr2));
*/
}

test();

/*
import { tablekeys } from './utils';

let x = {
  prop1: 'he',
  prop2: 'ka'
};

console.log(tablekeys(x, 'q'));
*/
//test();
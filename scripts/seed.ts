import 'dotenv/config';
import {db} from '../src/db';
import {events,eventTables,mealOptions,categories,members} from '../src/db/schema';
import {eq} from 'drizzle-orm';
async function main(){const ms=await db.select().from(members).limit(1);if(!ms.length)throw Error('First create an account and bootstrap an organization in the app');const org=ms[0].organizationId;const [e]=await db.insert(events).values({organizationId:org,name:'2027 Scholarship Dinner & Dance',date:'2027-05-15',venue:'Community Civic Center',capacity:100,status:'Published',source:'External registration platform'}).returning();await db.insert(eventTables).values(Array.from({length:10},(_,i)=>({eventId:e.id,number:i+1,name:`Table ${i+1}`,capacity:10})));await db.insert(mealOptions).values(['Chicken','Beef','Fish','Vegetarian'].map(name=>({eventId:e.id,name})));await db.insert(categories).values({eventId:e.id,name:'General Admission'});console.log('Created demonstration event',e.id);}
main().catch(e=>{console.error(e);process.exit(1)});

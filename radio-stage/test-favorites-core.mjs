import assert from 'node:assert/strict';
import {approvedTeam,validStream,cleanSong,newestFirst,artistFromCard,songKey,MAX_SAVED} from './tscms-favorites-core.mjs';
const goodUser={uid:'testuser',emailVerified:true},profile={status:'approved',admin:true};
const tests=[
 ['signed-out never approved',()=>assert.equal(approvedTeam(null,profile),false)],
 ['email not verified never approved',()=>assert.equal(approvedTeam({...goodUser,emailVerified:false},profile),false)],
 ['pending and revoked never approved',()=>{assert.equal(approvedTeam(goodUser,{...profile,status:'pending'}),false);assert.equal(approvedTeam(goodUser,{...profile,status:'revoked'}),false)}],
 ['nonteam accounts never approved',()=>assert.equal(approvedTeam(goodUser,{status:'approved',admin:false,owner:false}),false)],
 ['approved owner/team allowed',()=>{assert.equal(approvedTeam(goodUser,profile),true);assert.equal(approvedTeam(goodUser,{status:'approved',owner:true}),true)}],
 ['stream requires HTTPS, no empty or script URL',()=>{assert.equal(validStream('https://cdn1.suno.ai/test.mp4'),true);assert.equal(validStream('javascript:alert(1)'),false);assert.equal(validStream('http://bad.local/file'),false)}],
 ['full original artist and title preserved',()=>assert.deepEqual(cleanSong({title:'Eleanor Rose — Long Title',artist:'Singer & Friends',play_url:'https://cdn1.suno.ai/test.mp4'}),{title:'Eleanor Rose — Long Title',artist:'Singer & Friends',play_url:'https://cdn1.suno.ai/test.mp4'})],
 ['unverified/empty song never saved',()=>assert.equal(cleanSong({title:'unknown',artist:'Nobody',stream:''}),null)],
 ['newest-saved order',()=>assert.deepEqual(newestFirst([{id:1,savedAt:{seconds:8}},{id:2,savedAt:{seconds:10}}]).map(x=>x.id),[2,1])],
 ['artist name not shortened or renamed',()=>assert.equal(artistFromCard('by Minnie “Red” Lou · 3d ago'),'Minnie “Red” Lou')],
 ['stable 64-digit song id',async()=>assert.match(await songKey('https://cdn1.suno.ai/test.mp4'),/^song-[0-9a-f]{64}$/)],
 ['finite safe collection cap',()=>assert.equal(MAX_SAVED,500)]
];
for(const [name,fn] of tests){await fn();console.log('PASS '+name)}
console.log(tests.length+'/'+tests.length+' Favorites core checks passed; hosted Auth/Firestore/DOM remains Cherish acceptance gate.');

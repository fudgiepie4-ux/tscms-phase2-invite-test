'use strict';
// Test-only: actual Firestore Security Rules Emulator. NO production project,
// service-account key, billing, client auth session, or deployed rule change.
const fs = require('node:fs');
const path = require('node:path');
const {
  initializeTestEnvironment, assertSucceeds, assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp,
} = require('firebase/firestore');

const projectId = 'demo-tscms-favorites-integration';
if (!process.env.FIRESTORE_EMULATOR_HOST ||
    !process.env.FIRESTORE_EMULATOR_HOST.includes('127.0.0.1:8089') ||
    process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId) {
  throw new Error('REFUSED: requires isolated localhost emulator only');
}
const rules=fs.readFileSync(path.join(__dirname,'merged-phase1-v4-favorites-20261023.rules'),'utf8');
const SONG_A='song-'+('a'.repeat(64));
const SONG_B='song-'+('b'.repeat(64));
let count=0;
(async()=>{
  const env=await initializeTestEnvironment({
    projectId,firestore:{host:'127.0.0.1',port:8089,rules}
  });
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async context=>{
      const db=context.firestore();
      for(const [id,status,admin,owner] of [
        ['owner-test','approved',true,true],
        ['admin-test','approved',true,false],
        ['user-test','approved',false,false],
        ['pending-test','pending',true,false],
        ['revoked-test','revoked',true,false],
        ['unverified-test','approved',true,false]
      ]) await setDoc(doc(db,'users',id),{status,admin,owner,email:id+'@example.invalid'});
      for(const id of ['owner-test','admin-test','user-test','pending-test','revoked-test','unverified-test'])
        await setDoc(doc(db,'users',id,'favorites',SONG_A),{title:'Seed',artist:'Test',play_url:'https://example.invalid/s.mp4',savedAt:new Date()});
      await setDoc(doc(db,'pilotAggregates','favorites'),{totalHearts:2,activeMembers:1});
      await setDoc(doc(db,'config','migration'),{pinRegistrationOpen:false,cutoffDate:'2026-11-01'});
      await setDoc(doc(db,'vault','keys'),{testOnly:true});
    });
    const authed=(id,verified=true)=>env.authenticatedContext(id,{email_verified:verified}).firestore();
    const anon=env.unauthenticatedContext().firestore();
    const owner=authed('owner-test'),admin=authed('admin-test'),ordinary=authed('user-test');
    const pending=authed('pending-test'),revoked=authed('revoked-test'),unverified=authed('unverified-test',false);
    async function test(label,operation,expectedPass) {
      if(expectedPass)await assertSucceeds(operation());
      else await assertFails(operation());
      count++;console.log('PASS '+count+': '+label);
    }
    await test('verified admin reads own Favorites',()=>getDoc(doc(admin,'users','admin-test','favorites',SONG_A)),true);
    await test('verified owner reads own Favorites',()=>getDoc(doc(owner,'users','owner-test','favorites',SONG_A)),true);
    await test('admin cannot read owner Favorites',()=>getDoc(doc(admin,'users','owner-test','favorites',SONG_A)),false);
    await test('approved ordinary member cannot read own pilot Favorites',()=>getDoc(doc(ordinary,'users','user-test','favorites',SONG_A)),false);
    await test('pending admin denied Favorites',()=>getDoc(doc(pending,'users','pending-test','favorites',SONG_A)),false);
    await test('revoked admin denied Favorites',()=>getDoc(doc(revoked,'users','revoked-test','favorites',SONG_A)),false);
    await test('unverified admin denied Favorites',()=>getDoc(doc(unverified,'users','unverified-test','favorites',SONG_A)),false);
    await test('signed out denied Favorites',()=>getDoc(doc(anon,'users','admin-test','favorites',SONG_A)),false);
    await test('admin can list own Favorites',()=>getDocs(collection(admin,'users','admin-test','favorites')),true);
    await test('admin cannot list another member Favorites',()=>getDocs(collection(admin,'users','owner-test','favorites')),false);
    const valid=()=>({title:'Full title',artist:'Full artist',play_url:'https://example.invalid/live.mp4',savedAt:serverTimestamp()});
    await test('verified admin may save OWN valid immutable snapshot',()=>setDoc(doc(admin,'users','admin-test','favorites',SONG_B),valid()),true);
    await test('client cannot save invalid key',()=>setDoc(doc(admin,'users','admin-test','favorites','not-a-songkey'),valid()),false);
    await test('client cannot save URL with insecure transport',()=>setDoc(doc(admin,'users','admin-test','favorites','song-'+('c'.repeat(64))),{...valid(),play_url:'http://example.invalid/stream'}),false);
    await test('client cannot inject unexpected fields',()=>setDoc(doc(admin,'users','admin-test','favorites','song-'+('d'.repeat(64))),{...valid(),admin:true}),false);
    await test('snapshot update forbidden, even for owner of it',()=>updateDoc(doc(admin,'users','admin-test','favorites',SONG_A),{title:'tampered'}),false);
    await test('client cannot delete someone else Favorites',()=>deleteDoc(doc(admin,'users','owner-test','favorites',SONG_A)),false);
    await test('client can delete OWN Favorites',()=>deleteDoc(doc(admin,'users','admin-test','favorites',SONG_A)),true);
    await test('owner reads aggregate only',()=>getDoc(doc(owner,'pilotAggregates','favorites')),true);
    await test('approved admin cannot read aggregate',()=>getDoc(doc(admin,'pilotAggregates','favorites')),false);
    await test('normal user cannot read aggregate',()=>getDoc(doc(ordinary,'pilotAggregates','favorites')),false);
    await test('owner cannot directly overwrite aggregate',()=>setDoc(doc(owner,'pilotAggregates','favorites'),{totalHearts:99}),false);
    await test('owner can list users (baseline Admin)',()=>getDocs(collection(owner,'users')),true);
    await test('nonowner cannot list users',()=>getDocs(collection(admin,'users')),false);
    await test('approved admin reads vault (baseline Admin)',()=>getDoc(doc(admin,'vault','keys')),true);
    await test('ordinary user cannot read vault',()=>getDoc(doc(ordinary,'vault','keys')),false);
    await test('signed-in user reads migration flag (baseline Admin)',()=>getDoc(doc(pending,'config','migration')),true);
    await test('anon cannot read migration flag',()=>getDoc(doc(anon,'config','migration')),false);
    await test('even owner cannot overwrite migration flag',()=>setDoc(doc(owner,'config','migration'),{pinRegistrationOpen:true}),false);
    console.log('ACTUAL LOCAL FIRESTORE EMULATOR PASS '+count+'/'+count+
      '; TEST fixtures only. NOT a production rules deploy/readback.');
  } finally {await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});

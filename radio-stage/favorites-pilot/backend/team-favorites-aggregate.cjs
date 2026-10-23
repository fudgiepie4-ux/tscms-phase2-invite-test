/* TSCMS Favorites pilot — owner-only aggregate.
 * STAGING SOURCE ONLY. Deploy only after installed v4 Rules emulator QA
 * and a separate Owner SHIP tap. NO service account keys in this repository.
 * Deployable via Firebase Functions v2 onCall, NOT enabled by this file.
 */
'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getApps,initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
if(!getApps().length)initializeApp();
const db=getFirestore();
exports.getTeamFavoritesAggregate=onCall({region:'us-central1',enforceAppCheck:false},async request=>{
  const uid=request.auth?.uid;
  if(!uid || request.auth?.token?.email_verified!==true)
    throw new HttpsError('unauthenticated','Team owner sign-in required.');
  const owner=await db.doc('users/'+uid).get();
  const profile=owner.exists?owner.data():null;
  if(!profile || profile.status!=='approved' || profile.owner!==true)
    throw new HttpsError('permission-denied','This count is for the approved owner only.');
  // Privileged server reads; never reveal, transmit or log individuals' data.
  const team=await db.collection('users').where('status','==','approved').get();
  let totalHearts=0, activeMembers=0;
  for(const member of team.docs){
    const p=member.data();
    if(p.admin!==true && p.owner!==true)continue;
    const countSnap=await member.ref.collection('favorites').count().get();
    const count=Number(countSnap.data()?.count)||0;
    totalHearts+=count;
    if(count>0)activeMembers++;
  }
  return {totalHearts,activeMembers,countedAt:new Date().toISOString()};
});

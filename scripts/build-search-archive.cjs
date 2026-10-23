'use strict';
// TSCMS Search: verified-only song archive. This runs AFTER Cherish's playlist extraction,
// never by scraping public HTML, and NEVER operates on private Admin/Dicey data.
// Usage: node scripts/build-search-archive.cjs --input <extracted-songs.json> --archive <private-archive.json> --output <public-search-index.json>
// Incoming records must provide exact title, artist, resolved stream/play_url, and station-week date YYYY-MM-DD.
// First run can seed multiple weeks from the approved Oct 8–22 post extraction.
// Each subsequent weekly run merges songs into the saved archive; it never silently drops older verified songs.
const fs=require('node:fs');
const path=require('node:path');
const MAX_WEEKS=7; // current station week plus the prior six
function isValidDate(v){
  if(typeof v!=='string'||!/^\d{4}-\d\d-\d\d$/.test(v))return false;
  const d=new Date(v+'T00:00:00Z');
  return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===v;
}
function safeStream(v){
  return typeof v==='string'&&/^https:\/\/[a-z0-9.-]+\/[^\s<>"'`]+$/i.test(v) &&
    !/\/\//.test(v.slice(8,16)) && v.length<=2048 &&
    /\.(?:mp3|m4a|mp4|wav|ogg)(?:[?#]|$)/i.test(v);
}
function validText(v){
  return typeof v==='string'&&v.trim().length>0&&v.trim().length<=500&&
    !/^https?:\/\//i.test(v.trim())&&!/^(?:unknown|n\/a|untitled|no title)$/i.test(v.trim());
}
function normalize(row){
  if(!row||typeof row!=='object')return null;
  const artist=row.artist, title=row.title;
  const play_url=row.play_url||row.stream; // must be a REAL playable stream, not an invented link
  const week=row.week; // authoritative station week from playlist extraction
  if(!validText(artist)||!validText(title)||!safeStream(play_url)||!isValidDate(week))return null;
  const out={artist:artist.trim(),title:title.trim(),play_url:play_url.trim(),week};
  if(typeof row.post_url==='string'&&/^https:\/\/(?:www\.)?(?:facebook\.com|m\.facebook\.com)\/\S+$/i.test(row.post_url)){
    out.post_url=row.post_url;
  }
  return out;
}
function mergeIndex(previous,incoming,generated){
  const old=Array.isArray(previous?.songs)?previous.songs:[];
  const rows=Array.isArray(incoming)?incoming:Array.isArray(incoming?.songs)?incoming.songs:null;
  if(!rows)throw new Error('Input must be a songs array from the playlist extraction.');
  if(!rows.length)throw new Error('Refusing to replace archive with an empty extraction.');
  const accepted=rows.map(normalize).filter(Boolean);
  if(!accepted.length)throw new Error('No verified artist + title + stream + week records; refuse empty publication.');
  const byKey=new Map();
  for(const raw of old){const row=normalize(raw);if(row)byKey.set(row.week+'|'+row.play_url,row);}
  for(const row of accepted)byKey.set(row.week+'|'+row.play_url,row);
  const weeks=[...new Set([...byKey.values()].map(r=>r.week))].sort().reverse().slice(0,MAX_WEEKS);
  const keep=new Set(weeks);
  const songs=[...byKey.values()].filter(r=>keep.has(r.week))
    .sort((a,b)=>b.week.localeCompare(a.week)||a.artist.localeCompare(b.artist)||a.title.localeCompare(b.title));
  return {
    schema_version:1,
    generated,
    coverage:{first_week:weeks.at(-1),last_week:weeks[0],week_count:weeks.length,
      label:weeks.length===1?'Verified songs from week of '+weeks[0]:
      'Verified songs from '+weeks.length+' archived station weeks ('+weeks.at(-1)+' to '+weeks[0]+')'},
    count:songs.length,
    songs,
    audit:{incoming:rows.length,accepted:accepted.length,rejected:rows.length-accepted.length,
      duplicates_merged:old.length+accepted.length-byKey.size}
  };
}
function parseArgs(argv){
  const result={};for(let i=0;i<argv.length;i+=2){
    if(!argv[i]?.startsWith('--')||argv[i+1]===undefined)throw new Error('Expected --input --archive --output options');
    result[argv[i].slice(2)]=argv[i+1];
  }
  if(!result.input||!result.archive||!result.output)throw new Error('Require --input --archive --output');
  if(new Set([result.input,result.archive,result.output].map(p=>path.resolve(p))).size!==3)
    throw new Error('Input, archive and output files must have distinct paths.');
  return result;
}
function writeAtomic(filename,value){
  fs.mkdirSync(path.dirname(filename),{recursive:true});
  const temp=filename+'.tmp-'+process.pid;
  fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  fs.renameSync(temp,filename);
}
function main(argv){
  const opts=parseArgs(argv);
  const extracted=JSON.parse(fs.readFileSync(opts.input,'utf8'));
  const previous=fs.existsSync(opts.archive)?JSON.parse(fs.readFileSync(opts.archive,'utf8')):{songs:[]};
  const generated=opts.generated||new Date().toISOString();
  if(!Number.isFinite(Date.parse(generated)))throw new Error('Invalid generated time');
  const merged=mergeIndex(previous,extracted,generated);
  // Archive retains audit; public index is strictly lean and does not expose ingestion diagnostic counters.
  const {audit,...publicIndex}=merged;
  writeAtomic(opts.archive,merged);
  writeAtomic(opts.output,publicIndex);
  console.log(JSON.stringify({count:merged.count,coverage:merged.coverage,audit}));
}
module.exports={normalize,mergeIndex,isValidDate,safeStream,parseArgs};
if(require.main===module)main(process.argv.slice(2));

s=open('page.html').read()
e=open('engine.js').read().replace("if(typeof LOCS==='undefined' && typeof require!=='undefined'){ var {LOCS,ROOFS}=require('./locations.js'); }\n","").replace("if(typeof module!=='undefined'){ module.exports={sim,DEF,WK,weatherFactor,residentWeight,inR}; }","")
l=open('locations.js').read().replace("if(typeof module!=='undefined') module.exports={LOCS,ROOFS};","")
open('padel-club-tycoon.html','w').write(s.replace('/*ENGINE*/',l+'\n'+e))

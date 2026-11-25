if(typeof LOCS==='undefined' && typeof require!=='undefined'){ var {LOCS,ROOFS}=require('./locations.js'); }
// Padel club tycoon engine — monthly simulation, month 0 = pre-launch presale.
const WK = 4.33;
const DEF = {
  courts:3, baseOpex:100000, extraCourtOpex:26000, extraCourtCapex:20000,
  loc:'shenzhen', roof:'covered', costIdx:1.0, office:0.9, tourist:0.05,
  pricePeak:42, priceOff:26, varHr:5, latent:25000, comp:5, compGrowth:0.6, mktGrowth:0.035,
  starterOn:1, starterPerWeek:6, starterPrice:9, starterSize:6, starterConv:25, miniOn:1, familyOn:1,
  market:700, startPlayers:150, startAudience:1500, startCash:40000,
  mkt:800, cac:35, competitor:0, competitorMonth:15,
  memOn:1, memFee:49, memDisc:20, annualShare:30, annualDisc:15,
  foundOn:1, foundSeats:120, foundPrice:450,
  walletOn:1, walletBonus:10, breakage:5,
  kidsOn:1, kidsFee:95, kidsPerWeek:2, groupSize:6, coachHr:25, schools:2, schoolCost:150, campsOn:1, kidsPrepay:1,
  coachOn:1, lessonPrice:55,
  socialsOn:1, socials:3, socialFee:15,
  tourOn:1, tourFee:35,
  corpOn:1, corpBD:600, corpPrice:4800,
  sponsorOn:1, sponsorCourts:2, sponsorPrice:6000,
  smartAccess:1, dynPricing:1, replay:1, ballMachine:1, vending:1,
  contentOn:1, content:400, proEvent:1, proMonth:4,
  capexMode:'rent', convRevshare:0, ownerShare:0.1, rentPortion:0.45, convHasRoof:0, convSlabReuse:0, convStrip:2500, convSlab:8000, convLights:2000, buildGround:16000, convContingency:0.15, convRentCut:0.35, convClubReuse:1, footfall:400, siteType:'pitch', convHVAC:0, convFitout:0.4, ownerCapex:0, closedDay:0,
  moveEvery:0, moveTeardown:2500, moveBase:6000, moveReinstall:4000, moveRoof:8000, moveClub:5000, moveKitLoss:0.05, moveDown:3, moveChurn:0.1,
  acqPerCourt:22000, acqRefurb:5000, acqPlayers:180, acqBrand:25, mgmtFee:0.08, mgmtIncentive:0.2,
  courtKit:20000, roofCostCovered:30000, roofCostIndoor:55000, fitout:40000, preopen:15000, buildRentCut:0.3,
  overheadPct:0.12, academyFill:0.7, debtShare:0.4, rate:0.08, termYears:5, exitMult:4, demandScale:0.75, calib:null,
  // ---- non-rental income plan. Prices are USD at the Bangkok reference; take-up scales by the city addon index.
  racketOn:1, racketPrice:3, racketTake:12,
  retailOn:1, retailSpend:0.8, retailMargin:35,
  cafeOn:1, cafeOwn:0, cafeSpend:1.6, cafeConcession:12, cafeOwnMargin:22,
  sponsorCardOn:1, sponsorCardValue:26000,
  passOn:0, passPrice:60, passShare:15, passHrs:4, passCannibal:50,
  starterPassOn:0, starterPassPrice:30, starterPassShare:10,
  partyOn:0, parties:6, partyPrice:260, partyCost:30,
  teamOn:0, teamDays:2, teamPrice:900, teamCost:35,
  clipsOn:0, clipPrice:6, clipTake:3,
  peOn:0, peSchools:2, peHours:3, peHourly:45,
  packsOn:0, packs:40, packPrice:12, classPackOn:0, classPackDisc:10,
  familyWalletOn:0, familyTopup:400, familyShare:20,
  bizWalletOn:0, bizWallets:3, bizWalletValue:3000,
  giftOn:0, gifts:20, giftValue:60,
  referralOn:0, referralCredit:6,
  custody:-1, sponsorRenew:80, govRentSub:0, voucherOn:0, voucherValue:8, sponsorTaxBreak:0, sportsRelief:0,
  startMoy:1, months:36
};
// setup cost of the non-rental modules, USD before the local cost index (mirrors AUTO)
const NRCAPEX = {racket:1800, retail:4000, cafeOwn:18000, party:1500, team:1200, clips:0, pe:1200, packs:600, wallets:0};
// Weekly slot grid: weekday/weekend x start hour 06..23. Open 07–23; smart access adds 06 and 23.
const WD_BASE={6:.25,7:.5,8:.45,9:.3,10:.3,11:.3,12:.45,13:.35,14:.3,15:.35,16:.5,17:.8,18:1,19:1.1,20:1.1,21:.9,22:.6,23:.3};
const WE_BASE={6:.3,7:.55,8:.8,9:1,10:1.1,11:1.1,12:.9,13:.85,14:.85,15:.9,16:.95,17:.95,18:.9,19:.8,20:.7,21:.55,22:.4,23:.2};
const TOUR_W={6:.3,7:.6,8:1,9:1,10:1,11:1,12:.7,13:.7,14:.7,15:.7,16:.9,17:.9,18:.9,19:.9,20:.5,21:.5,22:.2,23:.05};
function residentWeight(dt,h,o){ if(dt==='we') return WE_BASE[h]; let w=WD_BASE[h];
  if(h>=7&&h<=16&&h!==12) w*=1-0.55*o; else if(h===12) w*=1-0.1*o; else if(h===17) w*=1-0.2*o;
  else if(h>=18&&h<=21) w*=1+0.7*o; else if(h===22) w*=1+0.4*o; return w; }
// share of demand that still plays in this hour, given heat, cold, rain and roof
function weatherFactor(h,T,rd,roof){
  const dayHeat = h>=11&&h<=16?1:(h===9||h===10||h===17)?0.5:h===18?0.25:0;
  const heat = (clamp((T-29)*0.07,0,0.8)*dayHeat + clamp((T-35)*0.08,0,0.6))*roof.heat;
  const cold = clamp((14-T)*0.035,0,0.5)*roof.cold*((h>=18||h<=8)?1:0.5);
  const rain = rd/30*roof.rain, bonus = roof.rain<0.5 ? rd/30*0.12 : 0;
  return clamp(1-heat-cold-rain+bonus, 0.05, 1.15); }
const inR=(h,rs)=>rs.some(([a,b])=>h>=a&&h<=b);
const AUTO = { // capex, monthly cost (per club unless per court)
  smartAccess:{capex:6000, mo:150, save:1000},
  dynPricing:{capex:0, mo:200},
  replay:{capexCourt:2500, moCourt:60},
  ballMachine:{capex:4000, mo:40},
  vending:{capex:5000, mo:60}
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

function sim(inp){
  const p = Object.assign({}, DEF, inp);
  const N = p.months, courts = p.courts;
  const L = LOCS[p.loc]||LOCS.shenzhen, roof = ROOFS[p.roof]||ROOFS.covered;
  const ext = p.smartAccess ? 1 : 0;
  const SL=[]; let rwSum=0, twSum=0;
  for(const dt of ['wd','we']) for(let h=6;h<=23;h++){
    const days = dt==='wd'?5:2, open = ((h>=7&&h<=22)||(ext&&(h===6||h===23))) && !(p.closedDay&&dt==='wd'&&h>=7&&h<=15);
    const pk = inR(h, dt==='wd'?L.peakWd:L.peakWe);
    const rw = residentWeight(dt,h,p.office)*days*(p.calib&&p.calib[dt]&&p.calib[dt][h]!=null?p.calib[dt][h]:1), tw = TOUR_W[h]*days; rwSum+=rw; twSum+=tw;
    SL.push({dt,h,days,open,pk,cap:open?courts*days*WK:0,rw,tw,
      acad:open&&((dt==='wd'&&(h===15||h===16))||(dt==='we'&&(h===8||h===9))), camp:open&&dt==='wd'&&h>=9&&h<=14, soc:open&&!pk&&!((dt==='wd'&&(h===15||h===16))||(dt==='we'&&(h===8||h===9)))});
  }
  SL.forEach(s=>{s.rw/=rwSum; s.tw/=twSum;});
  const peakCap = SL.reduce((a,s)=>a+(s.pk?s.cap:0),0), offCapAll = SL.reduce((a,s)=>a+(s.pk?0:s.cap),0);
  const academyCapHrs = p.kidsOn ? SL.reduce((a,s)=>a+(s.acad?s.cap:0),0) : 0;
  const prox = p.proxOverride!=null ? p.proxOverride : (L.prox||0); let latentLeft = p.latent, eduPool = 0;
  const kidsPerCourt = p.groupSize*(p.miniOn?1.4:1); // mini-padel splits a court in two for under-8s (~40% of kids)
  const maxKids = academyCapHrs*kidsPerCourt/(p.kidsPerWeek*WK)*p.academyFill; // not every slot fills: ages, levels, school runs
  const memOn = p.memOn;
  const annualShare = memOn ? p.annualShare/100 : 0;
  const memPrice = p.memFee, annualPrice = memPrice*(1-p.annualDisc/100);
  const walletShare = p.walletOn ? Math.min(0.55, p.walletBonus/100*3.5) : 0;

  // capex at launch
  const isConv = p.capexMode==='convert', isAcq = p.capexMode==='acquire';
  let capex = p.capexMode==='rent' ? Math.max(0,courts-3)*p.extraCourtCapex : 0;
  if(p.smartAccess) capex+=AUTO.smartAccess.capex;
  if(p.replay) capex+=AUTO.replay.capexCourt*courts;
  if(p.ballMachine) capex+=AUTO.ballMachine.capex;
  if(p.vending) capex+=AUTO.vending.capex;
  if(p.starterOn) capex+=2000; if(p.miniOn&&p.kidsOn) capex+=1500;
  const capexAuto = capex;
  // non-rental fit-out: racket stock, retail stock, own-run café, party kit, school-PE kit, visitor packs
  const capexNR = ((p.racketOn?NRCAPEX.racket:0) + (p.retailOn?NRCAPEX.retail:0)
    + (p.cafeOn&&p.cafeOwn?NRCAPEX.cafeOwn:0) + (p.partyOn?NRCAPEX.party:0) + (p.teamOn?NRCAPEX.team:0)
    + (p.peOn?NRCAPEX.pe:0) + (p.packsOn?NRCAPEX.packs:0))*p.costIdx;
  const roofCost = p.roof==='indoor'?p.roofCostIndoor:p.roof==='covered'?p.roofCostCovered:0;
  // conversion: strip the pitch, lay a level slab + ring beam, install kits and lights; reuse roof/clubhouse where they exist
  const civilPerCourt = isConv ? (p.convStrip + (p.convSlabReuse?3500:p.convSlab) + p.convLights)*p.costIdx*(1+p.convContingency) : 0;
  const capexCivil = courts*civilPerCourt + (isConv?courts*p.convHVAC*Math.sqrt(p.costIdx):0);
  const capexCourts = p.capexMode==='build' ? courts*(p.courtKit+roofCost+p.buildGround*p.costIdx) : isConv ? (courts*(p.courtKit + (p.convHasRoof?0:roofCost)) + capexCivil)*(1-p.ownerCapex) : isAcq ? courts*(p.acqPerCourt + p.acqRefurb*p.costIdx) : 0;
  const rentFactor = (p.capexMode==='build'||isAcq) ? 1-p.buildRentCut : isConv ? (1-p.convRentCut)*(p.convRevshare ? 1-p.rentPortion : 1) : 1;
  const baseYear = (p.baseOpex*roof.opex + (courts-3)*p.extraCourtOpex*(courts<3?0.8:1))*p.costIdx*rentFactor;
  const deposit = baseYear/12*3;
  const fitoutCost = p.fitout*p.costIdx*(isConv?(p.convClubReuse?p.convFitout:1):isAcq?0.3:1);
  const capexGross = capexAuto + capexCourts + fitoutCost + p.preopen + deposit + capexNR;
  // No grant in Bangkok, Shenzhen or KL pays to build a private padel club. Public money here is
  // operating support, vouchers and tax breaks — never a reduction in the build cost.
  capex = capexGross;
  // Ring-fenced prepaid money is a customer liability, not funding: Shenzhen requires it by default.
  const custody = p.custody<0 ? (L.prepaidCustody?1:0) : (p.custody?1:0);
  const addonIdx = L.addonIdx!=null ? L.addonIdx : clamp(L.peak/50,0.6,1.3);
  const debt0 = capex*p.debtShare, equity0 = capex - debt0 + p.startCash;
  const mr = p.rate/12, nTerm = p.termYears*12;
  const pmt = debt0>0 ? (mr>0 ? debt0*mr/(1-Math.pow(1+mr,-nTerm)) : debt0/nTerm) : 0;
  let debtBal = debt0, minDSCR = Infinity;

  // state
  let A = p.startAudience + (isConv?p.footfall*0.5:0), B = isAcq?p.acqBrand:15;
  let found = 0;
  if(p.foundOn && memOn) found = Math.min(p.foundSeats, Math.round(A*0.05 + p.mkt/p.cac*0.5));
  let C = Math.max(0,p.startPlayers + (isAcq?p.acqPlayers:0) - found), Mm = 0, Ma = 0, K = 0, Corp = 0;
  let foundDef = found*p.foundPrice; // deferred, recognised over 12 months
  const foundMonthly = found*p.foundPrice/12;
  let cash = p.startCash + (custody?0:foundDef);
  let def = {annual:0, wallet:0, kids:0, corp:0, sponsor:0, found:foundDef, family:0, biz:0, gift:0};
  let sponsorDeals = 0, sponsorPaidMonth = -99;
  const out = [];
  out.push({m:0, cash, presale:found*p.foundPrice, found, capex, float:foundDef, eqCF:-equity0, debtBal});
  let cumCF = cash - p.startCash; let newKidsPrev = 0;

  for(let t=1;t<=N;t++){
    const moy = ((t-1+p.startMoy-1)%12)+1; // calendar month (opening month = startMoy)
    const T = L.hi[moy-1], rd = L.rain[moy-1], cal = L.cal[moy-1];
    SL.forEach(x=>{x.wf=weatherFactor(x.h,T,rd,roof);});
    const avg=(f)=>{let a=0,c=0;for(const x of SL)if(f(x)&&x.open){a+=x.wf*x.cap;c+=x.cap}return c?a/c:1};
    const wfAll = avg(()=>1), wfAcad = avg(x=>x.acad), wfCamp = avg(x=>x.camp);
    const season = cal*(0.6+0.4*wfAll);
    const comp = p.competitor && t>=p.competitorMonth;
    const compCourts = Math.max(0,p.comp-(isAcq?courts:0))*Math.pow(1+p.compGrowth, t/12);
    const share = prox>0 ? courts/(courts+prox*compCourts) : 1;
    const mkt = Math.min(4, Math.pow(1+p.mktGrowth, t))*p.market;
    const resMarket = mkt*(1-p.tourist)*share + eduPool;

    // ---- kids academy
    let newKids = 0, waitlist = 0;
    if(p.kidsOn){
      const schoolKids = p.schools*25*0.05;
      const fromAud = A*0.0003, fromMembers = (Mm+Ma+found)*0.012;
      const priceF = Math.pow(p.kidsFee/110, -0.8);
      let want = (schoolKids + fromAud + fromMembers)*priceF*(1+B/150)*wfAcad*cal*(p.miniOn?1.2:1)*(p.familyOn?1.1:1);
      K *= (1-(p.familyOn?0.025:0.035));
      const room = Math.max(0, maxKids - K);
      newKids = Math.min(room, want); waitlist = Math.max(0, want-room);
      K += newKids;
    }
    const academyHrs = p.kidsOn ? K*p.kidsPerWeek*WK/kidsPerCourt : 0;
    const campOn = p.kidsOn && p.campsOn && [4,7,8,12].includes(moy);
    const campers = campOn ? Math.min(30, 8 + K*0.15 + p.schools*4)*wfCamp : 0;
    const campHrs = campOn ? 60 : 0;

    // ---- entry-level 'first rally' taster sessions (coach-led, loaner kit, 1 court-hour each)
    let starterHrs = 0, starters = 0, starterNew = 0;
    if(p.starterOn){
      const ref = 10*L.peak/45; // local reference price per head
      const want = (latentLeft*0.0035*(1+B/100) + A*0.002 + p.mkt/p.cac*0.6 + (p.schools||0)*3)*Math.pow(p.starterPrice/ref,-1.1)*cal*(0.5+0.5*wfAll);
      const cap = p.starterPerWeek*WK*p.starterSize;
      starters = Math.min(cap, want); starterHrs = p.starterPerWeek*WK*Math.min(1, want/cap*1.15);
      starterNew = Math.min(latentLeft, starters*(p.starterConv/100)*(p.familyOn?1.2:1));
      latentLeft -= starterNew;
    }
    // ---- programming reservations
    const socialHrs = p.socialsOn ? p.socials*WK*4 : 0; // 2 courts x 2h
    const tourHrsPeak = p.tourOn ? 16 : 0;
    const corpHrs = p.corpOn ? Corp*(4+4/3) : 0;
    const peHrs = p.peOn ? p.peSchools*p.peHours*WK : 0; // school PE lessons take weekday daytime courts
    const spHolders = p.starterPassOn ? C*(p.starterPassShare/100) : 0;
    const spHrs = spHolders*4/Math.max(4,p.groupSize); // starter pass: 4 coached beginner sessions a month
    const teamHrs = p.teamOn ? p.teamDays*2 : 0; // company team days: 2 hours each
    const players = C + Mm + Ma + found;
    const lessonHrs = p.coachOn ? players*0.06*1.5*Math.pow(p.lessonPrice/55,-0.7)*(p.classPackOn?1.12:1)*(1+p.sportsRelief/100) : 0;
    const ballHrs = p.ballMachine ? players*0.02*2 : 0;

    // ---- rental demand (sessions / 4 players per court hour)
    const members = Mm + Ma + found;
    const memDisc = memOn ? p.memDisc/100 : 0;
    const rP = L.peak*roof.premium, rO = L.off*roof.premium;
    const peakElC = Math.pow(p.pricePeak/rP,-0.6), offElC = Math.pow(p.priceOff/rO,-0.9);
    const peakElM = Math.pow(p.pricePeak*(1-memDisc)/rP,-0.4), offElM = Math.pow(p.priceOff*(1-memDisc)/rO,-0.6);
    const wl = 1 + walletShare*0.3; const fC = 2.0*wl, fM = 4.5*wl;
    const dynOff = p.dynPricing ? 1.12 : 1;
    const resPk = (C*fC*peakElC + members*fM*peakElM)/4*cal*p.demandScale, resOff = (C*fC*offElC + members*fM*offElM)/4*cal*dynOff*p.demandScale;
    const tourHrs = mkt*p.tourist*0.12*Math.sqrt(share)*L.tSeason[moy-1]*(0.6+B/100)*Math.pow(p.pricePeak/rP,-0.3);
    // reservations, spread over eligible slots pro rata to free capacity
    SL.forEach(x=>{x.kids=0;x.social=0;x.corp=0;x.coach=0;x.rent=0;x.tour=0;x.dem=0;x.starter=0;x.pe=0;});
    const free=x=>Math.max(0,x.cap-x.kids-x.social-x.corp-x.coach-x.starter-x.pe);
    const put=(hrs,f,key)=>{const el=SL.filter(x=>x.open&&f(x));const tot=el.reduce((a,x)=>a+free(x)*x.wf,0);if(!tot||hrs<=0)return;
      el.forEach(x=>{x[key]+=Math.min(free(x),hrs*free(x)*x.wf/tot)});};
    put(academyHrs,x=>x.acad,'kids'); put(starterHrs,x=>!x.pk&&!x.acad&&((x.dt==='wd'&&x.h>=10&&x.h<=13)||(x.dt==='we'&&x.h>=16&&x.h<=18)),'starter'); put(starterHrs-SL.reduce((a,x)=>a+x.starter,0),x=>!x.pk&&!x.acad,'starter'); put(campHrs,x=>x.camp,'kids'); put(socialHrs,x=>x.soc,'social');
    put(tourHrsPeak,x=>x.pk&&x.dt==='we','social');
    put(peHrs,x=>!x.pk&&x.dt==='wd'&&x.h>=9&&x.h<=14,'pe');
    put(spHrs,x=>!x.pk&&x.dt==='wd'&&x.h>=9&&x.h<=16,'coach');
    put(teamHrs,x=>!x.pk&&x.dt==='we','corp');
    put(corpHrs*0.5,x=>x.pk,'corp'); put(corpHrs*0.5,x=>!x.pk,'corp');
    put(lessonHrs*0.4,x=>x.pk,'coach'); put(lessonHrs*0.6+ballHrs,x=>!x.pk,'coach');
    let peakRes=0, offRes=0, dPeak=0, dOff=0, peakServed=0, offServed=0, unmet=0, tourServed=0;
    for(const x of SL){ const r=x.kids+x.social+x.corp+x.coach+x.starter+x.pe; if(x.pk)peakRes+=r; else offRes+=r;
      const dRes=(x.pk?resPk:resOff)*x.rw*x.wf, dT=tourHrs*x.tw*x.wf; x.dem=dRes+dT;
      if(x.pk)dPeak+=x.dem; else dOff+=x.dem;
      const sv=x.open?Math.min(x.dem,free(x)):0; x.rent=sv; x.tour=x.dem>0?sv*dT/x.dem:0; tourServed+=x.tour;
      if(x.pk){peakServed+=sv;unmet+=x.dem-sv;} else offServed+=sv; }
    // unmet peak demand partly moves to open off-peak hours, weighted to the pleasant ones
    const offGap = 1 - p.priceOff/p.pricePeak;
    let spill = unmet*clamp(0.15 + offGap*0.5, 0.1, 0.45);
    const offEl=SL.filter(x=>x.open&&!x.pk); const wsum=offEl.reduce((a,x)=>{const r=free(x)-x.rent;return r>0?a+r*x.wf:a},0);
    if(wsum>0) for(const x of offEl){const room=free(x)-x.rent; if(room<=0)continue; const add=Math.min(room,spill*room*x.wf/wsum); x.rent+=add; offServed+=add;}
    const peakFill = peakCap?(peakServed+peakRes)/peakCap:0;
    const offFill = offCapAll?(offServed+offRes)/offCapAll:0;
    const scarcity = peakCap?Math.max(0, (dPeak+peakRes)/peakCap - 0.9):0;
    const touristShare = (peakServed+offServed)>0 ? tourServed/(peakServed+offServed) : 0;
    const slots = SL.map(x=>({dt:x.dt,h:x.h,days:x.days,open:x.open,pk:x.pk,cap:x.cap,wf:x.wf,dem:x.dem,rent:x.rent,tour:x.tour,kids:x.kids,starter:x.starter,social:x.social,corp:x.corp,coach:x.coach,pe:x.pe}));

    // ---- revenue
    const memHrShare = players>0 ? (members*fM)/(C*fC + members*fM)*(1-touristShare) : 0;
    const dynPeakLift = p.dynPricing ? 1 + 0.10*clamp((peakFill-0.6)/0.35,0,1) : 1;
    const grossCourt = peakServed*p.pricePeak*dynPeakLift + offServed*p.priceOff;
    const memberDiscCost = grossCourt*memHrShare*memDisc;
    const courtNet = grossCourt - memberDiscCost;
    const walletCost = courtNet*walletShare*(p.walletBonus/100);
    const breakageRev = courtNet*walletShare*(p.breakage/100);
    const rev = {};
    rev.courtPeak = peakServed*p.pricePeak*dynPeakLift*(1-memHrShare*memDisc)*(1-walletShare*p.walletBonus/100);
    rev.courtOff = courtNet - walletCost - rev.courtPeak;
    const foundRev = t<=12 ? foundMonthly : 0;
    rev.membership = Mm*memPrice + Ma*annualPrice + foundRev;
    rev.coaching = lessonHrs*p.lessonPrice*(p.classPackOn?1-p.classPackDisc/100:1);
    rev.kids = K*p.kidsFee*(p.familyOn?0.95:1) + campers*150;
    rev.starter = starters*p.starterPrice;
    rev.programming = (p.socialsOn ? p.socials*WK*12*p.socialFee : 0) + (p.tourOn ? 32*p.tourFee*(0.7+B/200) : 0);
    rev.corporate = Corp*p.corpPrice/12;
    // sponsorship: deals signed once brand >= 30, renewed annually
    if(p.sponsorOn && sponsorDeals===0 && B>=30){ sponsorDeals = p.sponsorCourts; sponsorPaidMonth = t; }
    // deals renew annually; the rate card only keeps paying if sponsors renew
    if(sponsorDeals>0 && t>sponsorPaidMonth && (t-sponsorPaidMonth)%12===0){ sponsorDeals *= p.sponsorRenew/100; sponsorPaidMonth = t; }
    const sponsorValue = p.sponsorPrice*(0.6+B/100);
    rev.sponsorship = sponsorDeals*sponsorValue/12 + (p.tourOn && B>=30 ? 400*B/50 : 0);
    const sessions = (peakServed+offServed)*4;
    const visitsTour = tourServed*4;
    const visits = sessions + starters + K*p.kidsPerWeek*WK + campers*10 + (p.socialsOn?p.socials*WK*12:0)
                 + peHrs*8 + (p.partyOn?p.parties*12:0);
    // ---- non-rental income. Every stream is driven by traffic the model already produces,
    // not by a fixed estimate: visits, sessions, members, casual players and brand.
    const nr = {};
    nr.racket = p.racketOn ? visits*(p.racketTake/100)*p.racketPrice*addonIdx : 0;
    nr.retail = p.retailOn ? visits*p.retailSpend*addonIdx : 0;
    nr.cafe = p.cafeOn ? visits*p.cafeSpend*addonIdx*(p.cafeOwn?1:p.cafeConcession/100) : 0;
    nr.sponsorCard = (p.sponsorCardOn && sponsorDeals>0) ? p.sponsorCardValue*addonIdx*(0.6+B/100)/12*(1+p.sponsorTaxBreak/100) : 0;
    nr.parties = p.partyOn ? p.parties*p.partyPrice : 0;
    nr.team = p.teamOn ? p.teamDays*p.teamPrice : 0;
    nr.clips = (p.clipsOn && p.replay) ? sessions*(p.clipTake/100)*p.clipPrice*addonIdx : 0;
    nr.pe = p.peOn ? peHrs*p.peHourly : 0;
    nr.packs = p.packsOn ? p.packs*p.packPrice*(0.3+L.tourist*2)*addonIdx : 0;
    nr.vouchers = p.voucherOn ? starters*p.voucherValue : 0; // district sports vouchers: the state pays the first-visit discount
    const passHolders = p.passOn ? members*(p.passShare/100) : 0;
    nr.pass = passHolders*p.passPrice;
    // pass holders play off-peak for free: the fuller off-peak already is, the more of them
    // displace a booking that would have been paid for. Empty courts cost nothing to give away.
    const passCannib = clamp(p.passCannibal/100 + offFill*0.3, 0, 1);
    const passDisplaced = Math.min(rev.courtOff, passHolders*(p.passHrs/4)*p.priceOff*passCannib);
    rev.courtOff -= passDisplaced;
    nr.starterPass = spHolders*p.starterPassPrice;
    nr.biz = p.bizWalletOn ? p.bizWallets*p.bizWalletValue/12 : 0;
    nr.gift = p.giftOn ? p.gifts*p.giftValue*0.85 : 0;
    const famBal = p.familyWalletOn ? members*(p.familyShare/100)*p.familyTopup : 0;
    const bizBal = p.bizWalletOn ? p.bizWallets*p.bizWalletValue*0.5 : 0;
    const giftBal = p.giftOn ? p.gifts*p.giftValue*0.3 : 0;
    rev.sponsorship += nr.sponsorCard;
    rev.starter += nr.starterPass + nr.vouchers;
    rev.addons = nr.racket + nr.retail + nr.cafe;
    rev.events = nr.parties + nr.team + nr.clips + nr.packs;
    rev.pass = nr.pass;
    rev.schoolPE = nr.pe;
    rev.prepaid = nr.biz + nr.gift;
    rev.automation = (p.replay ? sessions/4*0.18*6 : 0) + (p.ballMachine ? ballHrs*(p.priceOff+10) : 0)
                   + (p.vending ? visits*0.5 : 0) + tourServed*4*3;
    rev.breakage = breakageRev + (famBal+bizBal+giftBal)*(p.breakage/100)/12;
    const revenue = Object.values(rev).reduce((a,b)=>a+b,0);

    // ---- costs
    const cost = {};
    cost.base = baseYear/12 - (p.smartAccess?AUTO.smartAccess.save:0) - (t<=24 ? baseYear/12*(p.govRentSub/100) : 0);
    // goods sold, café run in-house, party delivery, racket wear, visitor-pack contents
    cost.addons = nr.retail*(1-p.retailMargin/100) + (p.cafeOn&&p.cafeOwn ? nr.cafe*(1-p.cafeOwnMargin/100) : 0)
                + nr.racket*0.25 + nr.parties*(p.partyCost/100) + nr.team*(p.teamCost/100) + nr.packs*0.45 + nr.clips*0.1;
    cost.owner = isConv && p.convRevshare ? (rev.courtPeak+rev.courtOff+rev.membership+rev.breakage)*p.ownerShare : 0;
    const usedHrs = peakServed+offServed+peakRes+offRes;
    cost.variable = usedHrs*p.varHr*Math.sqrt(p.costIdx) + revenue*0.025;
    cost.climate = p.roof==='indoor' ? usedHrs*(0.8+0.25*Math.max(0,T-24))*Math.sqrt(p.costIdx) : 0;
    cost.coaches = lessonHrs*p.lessonPrice*0.55 + academyHrs*p.coachHr + starterHrs*p.coachHr*1.2 + campers*150*0.35
                 + (p.socialsOn?p.socials*WK*40:0) + (p.tourOn?600:0) + (p.corpOn?Corp*20:0) + peHrs*p.coachHr + spHrs*p.coachHr;
    cost.growth = p.mkt + (p.contentOn?p.content:0) + (p.corpOn?p.corpBD:0) + (p.kidsOn?p.schools*p.schoolCost:0)
                + (p.proEvent && t===p.proMonth ? 5000 : 0)
                + (p.referralOn ? (out[t-1].newPlayers||0)*p.referralCredit*2 : 0); // credit to both sides, paid in credit not cash
    cost.automation = (p.smartAccess?AUTO.smartAccess.mo:0)+(p.dynPricing?AUTO.dynPricing.mo:0)
                    +(p.replay?AUTO.replay.moCourt*courts:0)+(p.ballMachine?AUTO.ballMachine.mo:0)+(p.vending?AUTO.vending.mo+visits*0.5*0.55:0);
    const progs = (p.kidsOn?1:0)+(p.socialsOn?1:0)+(p.tourOn?1:0)+(p.corpOn?1:0)+(p.coachOn?1:0);
    cost.staff = (progs>=2?2500:0) + (progs>=4?2500:0) + (players>600?(p.smartAccess?900:1800):0) + (players>1200?(p.smartAccess?900:1800):0);
    cost.staff += revenue*p.overheadPct; // management, cleaning, maintenance, insurance that grow with the business
    cost.staff += (p.cafeOn&&p.cafeOwn ? 1400*Math.sqrt(p.costIdx) : 0) + (p.partyOn ? 300*Math.sqrt(p.costIdx) : 0);
    const moving = p.moveEvery>0 && t%p.moveEvery===0 && t<N;
    cost.move = moving ? revenue*Math.min(1,p.moveDown/WK)*0.8 : 0; // trading lost while courts come down and go up again
    const moveCapex = moving ? courts*(p.moveTeardown+p.moveBase+p.moveReinstall+(p.convHasRoof?0:p.moveRoof))*p.costIdx + courts*p.courtKit*p.moveKitLoss + p.moveClub*p.costIdx : 0;
    const opex = Object.values(cost).reduce((a,b)=>a+b,0);
    const ebitda = revenue - opex;

    // ---- deferred balances (cash = revenue + change in what customers prepaid)
    const prev = Object.assign({}, def);
    def.found = t<=12 ? found*p.foundPrice*(12-t)/12 : 0;
    def.annual = Ma*annualPrice*6;
    def.wallet = courtNet*walletShare*1.5;
    def.kids = p.kidsPrepay ? K*p.kidsFee*1.5 : 0;
    def.corp = Corp*p.corpPrice/2;
    def.sponsor = sponsorDeals ? sponsorDeals*sponsorValue*(12-((t-sponsorPaidMonth)%12))/12 : 0;
    def.family = famBal; def.biz = bizBal; def.gift = giftBal;
    let dDef = 0; for(const k in def) dDef += def[k]-prev[k];
    const float = Object.values(def).reduce((a,b)=>a+b,0);
    // ring-fenced float still exists as a liability but cannot be spent on the build or the running costs
    const freeFloat = custody ? 0 : float;
    const cf = ebitda + (custody?0:dDef) - moveCapex;
    let ds = 0; if(debtBal>0.01 && t<=nTerm){ const intr = debtBal*mr; ds = Math.min(pmt, debtBal+intr); debtBal = debtBal + intr - ds; }
    if(ds>0) minDSCR = Math.min(minDSCR, ebitda/ds);
    const eqCF = cf - ds;
    cash += eqCF; cumCF += cf;

    // ---- audience & brand
    const newPlayersPrevGuess = out[t-1].newPlayers||0;
    A = A*0.98 + (p.contentOn?p.content*0.6:0) + (p.replay?sessions/4*0.18*0.3:0)
      + (p.tourOn?250:0) + (p.socialsOn?p.socials*WK*3:0) + K*0.2 + newPlayersPrevGuess*0.3
      + (p.proEvent && t===p.proMonth ? 3000 : 0) + (p.sponsorOn&&sponsorDeals?60:0) + visitsTour*0.3 + starters*0.5
      + (p.partyOn?p.parties*8:0) + (p.giftOn?p.gifts*1.5:0);
    const Btarget = clamp(8 + 9*Math.log(1+A/800) + (p.tourOn?6:0) + (p.kidsOn?Math.min(10,K/15):0)
      + (p.socialsOn?4:0) + (p.proEvent && t>=p.proMonth && t<p.proMonth+6 ? 8 : 0) - scarcity*40, 0, 100);
    B += 0.15*(Btarget-B);

    // ---- player flows for next month
    const sat = Math.max(0, 1 - players/Math.max(100,resMarket));
    let acq = 25*(1+B/100) + p.mkt/p.cac*(1+B/200) + A*0.001*(1+B/100) + players*0.02*(1-scarcity*2)
            + (p.socialsOn?p.socials*WK*2*0.3:0) + newKids*(p.familyOn?0.45:0.25) + campers*0.08
            + (p.corpOn?Corp/3*16*0.08:0) + (p.tourOn?3:0) + visitsTour*0.01 + (isConv?p.footfall*0.01:0);
    if(comp) acq *= 0.85;
    if(p.referralOn) acq *= 1.08; // a friend brought by a friend, paid in credit
    if(p.voucherOn) acq *= 1.05; // the state pays the first-visit discount
    const newPlayers = Math.max(0, acq*sat*season);
    // corporate
    if(p.corpOn){ Corp = Corp*(1-0.024) + p.corpBD/1500*(1+B/150)*Math.pow(p.corpPrice/4800,-0.8)*(0.4+p.office); Corp=Math.min(Corp, 25); }
    const extraChurn = (comp?0.015:0) + scarcity*0.3;
    const churnC = 0.07+extraChurn-walletShare*0.02, churnMm = 0.03+extraChurn*0.6-(p.passOn?0.004:0)-(p.familyWalletOn?0.003:0), churnMa = 0.012+extraChurn*0.3;
    // membership conversion
    let conv = 0;
    if(memOn){
      const value = memDisc*fM*p.pricePeak/4*1.0 + Math.min(1,peakFill)*10 + 25;
      conv = 0.015*clamp(value/p.memFee, 0.2, 2.5)*(p.familyOn?1.15:1);
    }
    const toMem = C*conv;
    // founding renewals at month 12
    let foundRenew = 0;
    if(t===12 && found>0){ foundRenew = found*0.7; C += found*0.15; found = 0; }
    if(moving){ C*=1-p.moveChurn; Mm*=1-p.moveChurn*0.5; Ma*=1-p.moveChurn*0.3; K*=1-p.moveChurn*0.5; }
    C = C*(1-churnC) - toMem + newPlayers + starterNew;
    eduPool = eduPool*0.97 + starterNew + newKids*(p.familyOn?0.45:0.25);
    Mm = Mm*(1-churnMm) + toMem*(1-annualShare) + foundRenew*(1-annualShare);
    Ma = Ma*(1-churnMa) + toMem*annualShare + foundRenew*annualShare;

    out.push({m:t, rev, revenue, cost, opex, ebitda, cash, cf, float, freeFloat, def:Object.assign({},def),
      nr, visits, sessions, passHolders, peHrs, passDisplaced,
      players, C, members, K, waitlist, newKids, Corp, A, B, newPlayers,
      peakFill, offFill, peakServed, offServed, peakCap, offCapAll, academyHrs, campHrs, socialHrs, corpHrs, lessonHrs, ballHrs, tourHrsPeak, unmet,
      sponsorDeals, campers, ext, moveCapex, memHrShare, slots, starters, starterNew, starterHrs, share, compCourts, latentLeft, resMarket, T, rd, wfAll, tourServed, touristShare, dPeak, dOff, moy, ds, eqCF, debtBal});
  }
  // summary
  const ms = out.slice(1);
  const yr = y => { const s = ms.filter(o=>o.m>(y-1)*12 && o.m<=y*12); const sum=f=>s.reduce((a,o)=>a+f(o),0);
    const r={}; for(const k in s[0].rev) r[k]=sum(o=>o.rev[k]); const c={}; for(const k in s[0].cost) c[k]=sum(o=>o.cost[k]);
    return {rev:r, cost:c, revenue:sum(o=>o.revenue), opex:sum(o=>o.opex), ebitda:sum(o=>o.ebitda)}; };
  let be = null; for(let i=0;i<ms.length-2;i++){ if(ms[i].ebitda>0&&ms[i+1].ebitda>0&&ms[i+2].ebitda>0){be=ms[i].m;break;} }
  const minCash = Math.min(...out.map(o=>o.cash));
  const years = [1,2,3].filter(y=>y*12<=N).map(yr);
  const cum = ms.reduce((a,o)=>a+o.ebitda,0);
  const peakFloat = Math.max(...out.map(o=>o.float||0));
  // financing summary
  const last12 = ms.slice(-12).reduce((a,o)=>a+o.ebitda,0);
  const exitEV = Math.max(0, last12*p.exitMult);
  const eqFlows = out.map(o=>o.eqCF); eqFlows[N] += exitEV - debtBal + Math.max(0,0);
  const projFlows = out.map((o,i)=>i===0?-(capex+p.startCash):o.cf); projFlows[N] += exitEV;
  const irr = fl => { let lo=-0.99, hi=1; const npv=r=>fl.reduce((a,v,i)=>a+v/Math.pow(1+r,i),0); if(npv(lo)*npv(hi)>0) return null; for(let k=0;k<100;k++){const mid=(lo+hi)/2; if(npv(lo)*npv(mid)<=0) hi=mid; else lo=mid;} const m=(lo+hi)/2; return Math.pow(1+m,12)-1; };
  const eqNoExit = out.map(o=>o.eqCF); eqNoExit[N] += Math.max(0,cash - 0) * 0; 
  const dscrY = [1,2,3].filter(y=>y*12<=N).map(y=>{const sl=ms.filter(o=>o.m>(y-1)*12&&o.m<=y*12);const d=sl.reduce((a,o)=>a+o.ds,0);return d>0?sl.reduce((a,o)=>a+o.ebitda,0)/d:null;});
  let cumEq = 0, payback = null; for(let i=0;i<=N;i++){ cumEq += out[i].eqCF; if(i>0 && cumEq>=0 && payback===null) payback = i; }
  const moveCapexTotal = out.reduce((a,o)=>a+(o.moveCapex||0),0);
  const fin = {moveCapexTotal, capex, capexCourts, capexCivil, fitout:fitoutCost, mode:p.capexMode, capexAuto, capexNR, capexGross, preopen:p.preopen, deposit, debt0, equity0, pmt, minDSCR: isFinite(minDSCR)?minDSCR:null, payback, eqIRR: irr(eqFlows), eqIRRnoExit: irr(eqNoExit), dscrY, projIRR: irr(projFlows), exitEV, debtEnd: debtBal, last12};
  // ---- non-rental detail by year, and the plan's scorecard measured at month 24
  const nrYears = [1,2,3].filter(y=>y*12<=N).map(y=>{
    const s = ms.filter(o=>o.m>(y-1)*12 && o.m<=y*12), r={};
    for(const k in s[0].nr) r[k]=s.reduce((a,o)=>a+o.nr[k],0);
    r.displaced = s.reduce((a,o)=>a+o.passDisplaced,0);
    r.goods = s.reduce((a,o)=>a+o.cost.addons,0);
    return r; });
  // ---- the plan's own scorecard (Non-Rental Income Plan, "Checks before launch").
  // src:'model' = a simulated output; src:'input' = an assumption the plan sets, shown so it can be checked.
  const kM = out[Math.min(24,N)] || out[out.length-1], k12 = out[Math.min(12,N)] || kM;
  const rentalM = (kM.rev.courtPeak||0)+(kM.rev.courtOff||0);
  const addonPerVisit = kM.visits>0 ? (kM.nr.racket+kM.nr.retail+kM.nr.cafe+kM.nr.clips)/kM.visits : 0;
  const spendTarget = (L.spendTarget||120)/(L.fx||33); // ฿120 / ¥25 / RM15 per visit, in local money
  const kpis = [
    {id:'nrShare', label:'Non-rental share of revenue', v:kM.revenue>0?(kM.revenue-rentalM)/kM.revenue:0, target:0.55, fmt:'pct', src:'model'},
    {id:'memShare', label:'Members as a share of regular players', v:kM.players>0?kM.members/kM.players:0, target:0.30, fmt:'pct', src:'model'},
    {id:'annual', label:'Members paying yearly', v:memOn?p.annualShare/100:0, target:0.40, fmt:'pct', src:'input'},
    {id:'wallet', label:'Court revenue paid from wallets', v:walletShare, target:0.30, fmt:'pct', src:'model'},
    {id:'float12', label:"Customers' money held, month 12", v:k12.float, target:80000, fmt:'usd', src:'model'},
    {id:'spend', label:'Non-court spend per visit', v:addonPerVisit, target:spendTarget, fmt:'usd2', local:(L.ccy||'')+(L.spendTarget||120), src:'model'},
    {id:'breakage', label:'Credit never used', v:p.breakage/100, target:0.03, max:0.08, fmt:'pct', band:true, src:'input'},
    {id:'renew', label:'Sponsor renewals', v:p.sponsorRenew/100, target:0.80, fmt:'pct', src:'input'}
  ];
  kpis.forEach(k=>{k.pass = k.band ? (k.v>=k.target && k.v<=k.max) : k.v>=k.target; k.gap = k.target>0?k.v/k.target:0;});
  return {p, out, years, nrYears, kpis, breakEven:be, minCash, cumEbitda:cum, capex, peakFloat,
    peakFreeFloat: Math.max(...out.map(o=>o.freeFloat||0)), custody, addonIdx,
    presale: out[0].presale, maxKids, fin};
}

// ---------- site types for conversions (per-court USD before the local cost index) ----------
const SITETYPES = {
  pitch:{short:'an open football pitch', label:'Open football pitch', fit:'2–5 courts', note:'Strip turf, new slab, roof needed', p:{convHasRoof:0,convSlabReuse:0,convStrip:2500,convSlab:8000,convLights:2000,convHVAC:0,convClubReuse:1,convFitout:0.4,convRentCut:0.35,footfall:400,ownerCapex:0,closedDay:0,moveEvery:0,roof:'covered'}},
  futsal:{short:'a covered futsal hall', label:'Covered futsal / 5-a-side hall', fit:'2–3 courts', note:'Roof and concrete often reusable', p:{convHasRoof:1,convSlabReuse:1,convStrip:2500,convSlab:8000,convLights:2000,convHVAC:0,convClubReuse:1,convFitout:0.4,convRentCut:0.35,footfall:300,ownerCapex:0,closedDay:0,moveEvery:0,roof:'covered'}},
  tennis:{short:'tennis courts', label:'Tennis court (hotel, condo, club)', fit:'2 per court', note:'Hard base exists; add roof', p:{convHasRoof:0,convSlabReuse:1,convStrip:1000,convSlab:8000,convLights:2000,convHVAC:0,convClubReuse:1,convFitout:0.4,convRentCut:0.4,footfall:100,ownerCapex:0,closedDay:0,moveEvery:0,roof:'covered'}},
  badminton:{short:'a badminton hall', label:'Badminton or sports hall', fit:'~1 per 3 badminton courts', note:'Needs 6 m+ clear height', p:{convHasRoof:1,convSlabReuse:1,convStrip:1500,convSlab:8000,convLights:3000,convHVAC:6000,convClubReuse:1,convFitout:0.5,convRentCut:0.3,footfall:150,ownerCapex:0,closedDay:0,moveEvery:0,roof:'indoor'}},
  warehouse:{short:'a warehouse or factory hall', label:'Warehouse or factory hall', fit:'3–8 courts', note:'Height and slab usually fine; cooling and clubhouse needed', p:{convHasRoof:1,convSlabReuse:1,convStrip:500,convSlab:8000,convLights:3500,convHVAC:12000,convClubReuse:1,convFitout:1.0,convRentCut:0.45,footfall:0,ownerCapex:0,closedDay:0,moveEvery:0,roof:'indoor'}},
  mallRoof:{short:'a mall rooftop', label:'Mall rooftop or top car-park deck', fit:'2–6 courts', note:'Structural check; mall wants footfall', p:{convHasRoof:0,convSlabReuse:1,convStrip:500,convSlab:8000,convLights:2000,convHVAC:0,convClubReuse:1,convFitout:0.3,convRentCut:0.5,footfall:800,ownerCapex:0,closedDay:0,moveEvery:0,roof:'covered'}},
  mallUnit:{short:'a vacant mall unit', label:'Vacant mall anchor unit', fit:'2–4 courts', note:'Often too low: check 6 m clear', p:{convHasRoof:1,convSlabReuse:1,convStrip:1500,convSlab:8000,convLights:3000,convHVAC:3000,convClubReuse:1,convFitout:0.3,convRentCut:0.3,footfall:1200,ownerCapex:0,closedDay:0,moveEvery:0,roof:'indoor'}},
  movable:{short:'empty land awaiting development (movable courts)', label:'Movable courts on land awaiting development', fit:'2–6 courts', note:'Modular base; moved every lease term', p:{convHasRoof:0,convSlabReuse:0,convStrip:500,convSlab:6000,convLights:2000,convHVAC:0,convClubReuse:1,convFitout:0.5,convRentCut:0.6,footfall:0,ownerCapex:0,closedDay:0,moveEvery:24,roof:'covered'}},
  school:{short:'school grounds', label:'School grounds, shared use', fit:'2–3 courts', note:'School uses weekdays to 16:00 and pays half', p:{convHasRoof:0,convSlabReuse:1,convStrip:1000,convSlab:8000,convLights:2000,convHVAC:0,convClubReuse:1,convFitout:0.3,convRentCut:0.6,footfall:0,ownerCapex:0.5,closedDay:1,moveEvery:0,roof:'covered',schools:6}}
};
function cityP(id, roof){ const L=LOCS[id], pr=(ROOFS[roof]||ROOFS.covered).premium;
  return {proxOverride:null,calib:null,baseOpex:100000,loc:id,roof,pricePeak:Math.round(L.peak*pr),priceOff:Math.round(L.off*pr),market:L.market,costIdx:L.costIdx,office:L.office,tourist:L.tourist,latent:L.latent,comp:L.comp,compGrowth:L.compGrowth,mktGrowth:L.mktGrowth,startPlayers:L.start||150,starterPrice:Math.max(3,Math.round(9*L.peak/42))}; }

// ---------- guild: a players' community that fills partner clubs' courts (no courts of our own) ----------
const GDEF = {guildStart:150, guildNew:40, guildMkt:500, guildCac:15, guildFee:10, guildChurn:0.04,
  eventsPerWeek:6, eventPlayers:8, eventCourtHrs:4, eventFee:12, blockDisc:0.3, affRate:0.08, memberHrs:0.8, bounty:10,
  acadHrsWk:12, guildStaff:1500, guildApp:200, guildCapex:6000};
function simGuild(inp){
  const p = Object.assign({}, DEF, GDEF, inp), N = p.months, L = LOCS[p.loc]||LOCS.bangkok;
  const offHire = p.priceOff*(1-p.blockDisc), avgPrice = (p.pricePeak+p.priceOff)/2;
  const kidsCap = p.kidsOn ? p.acadHrsWk*p.groupSize*(p.miniOn?1.4:1)/p.kidsPerWeek*p.academyFill : 0;
  let G = p.guildStart, K = 0; const out=[{m:0, cf:-p.guildCapex, ebitda:0, members:G, kids:0}];
  for(let t=1;t<=N;t++){
    const moy=((t-1+p.startMoy-1)%12)+1, cal=L.cal[moy-1];
    const pool = Math.min(4,Math.pow(1+p.mktGrowth,t))*p.market*0.25 + p.latent*0.05;
    const sat = Math.max(0, 1-G/Math.max(50,pool));
    const evHrs = p.eventsPerWeek*WK*p.eventCourtHrs, evPlayers = Math.min(p.eventsPerWeek*WK*p.eventPlayers, G*1.2)*cal;
    const newM = (p.guildNew + p.guildMkt/p.guildCac + evPlayers*0.05)*sat*cal*p.demandScale;
    K = K*(1-0.03) + Math.min(Math.max(0,kidsCap-K), (4 + G*0.02)*cal);
    const rev = {fees:G*p.guildFee, events:evPlayers*p.eventFee, affiliate:G*p.memberHrs*avgPrice*p.affRate + newM*0.5*p.bounty,
      kids:K*p.kidsFee*0.95};
    const kidHrs = kidsCap>0 ? K*p.kidsPerWeek*WK/(p.groupSize*(p.miniOn?1.4:1)) : 0;
    const cost = {courts:(evHrs*Math.min(1,evPlayers/Math.max(1,p.eventsPerWeek*WK*p.eventPlayers)) + kidHrs)*offHire,
      coaches:kidHrs*p.coachHr + p.eventsPerWeek*WK*15*Math.sqrt(p.costIdx), staff:(p.guildStaff+(G>800?p.guildStaff:0))*p.costIdx + p.guildApp, growth:p.guildMkt};
    const revenue = Object.values(rev).reduce((a,b)=>a+b,0), opex = Object.values(cost).reduce((a,b)=>a+b,0);
    const ebitda = revenue - opex*(1) - revenue*0.03;
    const courtHrs = evHrs + kidHrs + G*p.memberHrs;
    out.push({m:t, rev, cost, revenue, opex, ebitda, cf:ebitda + (t===1?G*p.guildFee*3:0), members:G, kids:K, courtHrs, newM});
    G = G*(1-p.guildChurn) + newM;
  }
  let cum=0,payback=null; out.forEach((o,i)=>{cum+=o.cf; if(i>0&&cum>=0&&payback===null)payback=i;});
  return {p, out, capex:p.guildCapex, payback};
}
// owner-funded courts we operate: owner pays the build, we earn a fee + incentive
function managedFlows(r, p){ return r.out.map((o,i)=> i===0 ? {cf:-p.preopen*0.5, ebitda:0} : {cf:o.revenue*p.mgmtFee + Math.max(0,o.ebitda)*p.mgmtIncentive - 500*p.costIdx, ebitda:o.revenue*p.mgmtFee + Math.max(0,o.ebitda)*p.mgmtIncentive - 500*p.costIdx}); }

// ---------- network planner: several sites over a 60-month horizon ----------
const KINDS = {guild:'Guild + partner academy', rent:'Club in a finished facility', build:'Build on empty land', convert:'Conversion', satellite:'Satellite (1–2 courts, shared membership)', managed:'Owner-funded, we operate', acquire:'Buy a struggling club'};
function runNetwork(sites, base, H){
  H = H||60; const flow=new Array(H+1).fill(0), ebitda=new Array(H+1).fill(0), rows=[];
  const guildRuns = {};
  const order = sites.map((s,i)=>Object.assign({i},s)).sort((a,b)=>(a.kind==='guild'?0:1)-(b.kind==='guild'?0:1) || a.start-b.start);
  for(const s of order){
    const start = Math.max(1, Math.min(H, +s.start||1)), months = H-start+1, roof = (s.kind==='convert'||s.kind==='satellite') && SITETYPES[s.site] ? SITETYPES[s.site].p.roof : 'covered';
    const prior = order.filter(o=>o!==s && o.kind!=='guild' && o.city===s.city && (+o.start)<start);
    const nP = Math.min(4, prior.length), courtsPrior = prior.reduce((a,o)=>a+(+o.courts||0),0);
    let p = Object.assign({}, base, cityP(s.city, roof), {months, startMoy:((start-1)%12)+1, courts:+s.courts||3, calib:null});
    if(s.kind!=='guild'){
      const catch_ = s.kind==='satellite' ? 0.35 : nP>0 ? 0.6 : 1; p.market*=catch_; p.latent*=catch_; p.startPlayers*=catch_; p.comp += courtsPrior; p.demandScale = base.demandScale*(1+0.05*nP); p.overheadPct = Math.max(0.06, base.overheadPct-0.015*nP); p.mkt = base.mkt*Math.pow(0.8,Math.min(3,nP));
      const g = guildRuns[s.city]; if(g){ const gm = (g.out[start-g.start+1]||g.out[g.out.length-1]).members||0; p.startPlayers += Math.min(300, gm*0.3); p.startAudience += gm; }
    }
    let r=null, flows=null, upfront=0;
    if(s.kind==='guild'){ r = simGuild(p); r.start=start; guildRuns[s.city]=r; flows=r.out.map(o=>({cf:o.cf,ebitda:o.ebitda})); upfront=r.capex; }
    else {
      Object.assign(p,{moveEvery:0,closedDay:0,ownerCapex:0,proxOverride:null});
      if(s.kind==='satellite'){ Object.assign(p, SITETYPES[s.site||'tennis'].p, {capexMode:'convert', baseOpex:60000, mkt:200, content:0, corpOn:0, sponsorOn:0, foundOn:0, tourOn:0, proEvent:0, socials:2, schools:Math.min(p.schools,2), courts:Math.min(2,+s.courts||2)}); p.comp += 0; }
      else if(s.kind==='convert') Object.assign(p, SITETYPES[s.site||'pitch'].p, {capexMode:'convert'});
      else if(s.kind==='managed') Object.assign(p, {capexMode:'build'});
      else Object.assign(p, {capexMode:s.kind});
      p.courts = s.kind==='satellite' ? Math.min(2,+s.courts||2) : (+s.courts||3);
      r = sim(p);
      if(s.kind==='managed'){ flows = managedFlows(r,p); upfront = p.preopen*0.5; }
      else { flows = r.out.map((o,i)=> i===0 ? {cf:-r.capex + (o.float||0), ebitda:0} : {cf:o.cf, ebitda:o.ebitda}); upfront = r.capex; }
    }
    flows.forEach((f,i)=>{ const m = start-1+i; if(m<=H){ flow[m]+=f.cf; ebitda[m]+=f.ebitda; } });
    const last = r.out[r.out.length-1], last12 = flows.slice(-12).reduce((a,f)=>a+f.ebitda,0);
    rows.push({i:s.i, kind:s.kind, city:s.city, site:s.site, start, courts:s.kind==='guild'?0:p.courts, upfront, last12,
      players: s.kind==='guild' ? last.members : (last.players||0), kids: last.kids!=null?last.kids:(last.K||0), moveCapex:r.fin?r.fin.moveCapexTotal:0, payback: r.fin? r.fin.payback : r.payback});
  }
  let cum=0, minCum=0, minAt=0; const cumS=flow.map((v,i)=>{cum+=v; if(cum<minCum){minCum=cum;minAt=i;} return cum;});
  let payback=null; for(let i=minAt;i<=H;i++){ if(cumS[i]>=0 && i>0){payback=i;break;} }
  const years=[]; for(let y=1;y*12<=H;y++){ let e=0; for(let m=(y-1)*12+1;m<=y*12;m++) e+=ebitda[m]; years.push(e); }
  rows.sort((a,b)=>a.i-b.i);
  return {flow, ebitda, cum:cumS, peakNeed:-minCum, payback, years, rows, courts:rows.reduce((a,r)=>a+r.courts,0)};
}
if(typeof module!=='undefined'){ module.exports={sim,DEF,WK,weatherFactor,residentWeight,inR,SITETYPES,simGuild,runNetwork,cityP,KINDS,GDEF}; }

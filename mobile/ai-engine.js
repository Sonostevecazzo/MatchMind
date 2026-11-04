(function(root){
  "use strict";
  const STORAGE="matchmind-ai-model-v2-elo", VERSION="elo-temperature-calibration-v1";
  const MIN_SCORED=120, MIN_VALIDATION=40, DAY=86400000;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const classes=["home","draw","away"];
  const normalize=p=>{
    const values=classes.map(k=>Math.max(1e-9,Number(p&&p[k])||0));
    const sum=values.reduce((a,b)=>a+b,0);
    return Object.fromEntries(classes.map((k,i)=>[k,values[i]/sum]));
  };
  function applyTemperature(probabilities,temperature){
    const p=normalize(probabilities),t=clamp(Number(temperature)||1,.5,2.5);
    const weights=classes.map(k=>Math.pow(Math.max(1e-9,p[k]),1/t));
    const sum=weights.reduce((a,b)=>a+b,0);
    return Object.fromEntries(classes.map((k,i)=>[k,weights[i]/sum]));
  }
  function loss(rows,temperature){
    if(!rows.length)return{logLoss:Infinity,brier:Infinity};
    let ll=0,brier=0;
    for(const row of rows){
      const p=applyTemperature(row.p,temperature);
      ll-=Math.log(Math.max(1e-12,p[row.actual]));
      for(const k of classes)brier+=(p[k]-(row.actual===k?1:0))**2;
    }
    return{logLoss:ll/rows.length,brier:brier/rows.length};
  }
  function fitTemperature(rows){
    let best={temperature:1,...loss(rows,1)};
    for(let t=.65;t<=2.001;t+=.025){
      const candidate=loss(rows,t);
      if(candidate.logLoss<best.logLoss-1e-10)best={temperature:Number(t.toFixed(3)),...candidate};
    }
    return best;
  }
  function readModels(){
    try{const value=JSON.parse(localStorage.getItem(STORAGE)||"{}");return value&&typeof value==="object"?value:{}}catch(_){return{}}
  }
  function writeModels(value){try{localStorage.setItem(STORAGE,JSON.stringify(value))}catch(_){/* Private mode: keep this session functional. */}}
  function modelFor(competition){
    const model=readModels()[competition];
    return model&&model.version===VERSION&&model.approved===true?model:null;
  }
  function metrics(rows){
    return {count:rows.length,...loss(rows,1)};
  }
  function train(history,forecastFn,competition){
    const key=competition||"serie-a",today=new Date().toISOString().slice(0,10),all=readModels(),previous=all[key];
    const scoredFixtures=(history||[]).filter(m=>m&&m.date&&Number.isFinite(Number(m.hg))&&Number.isFinite(Number(m.ag))&&(m.competition||"serie-a")===key).slice().sort((a,b)=>a.date.localeCompare(b.date));
    let fingerprint=2166136261;
    for(const row of scoredFixtures){
      const value=[row.date,row.home,row.away,row.hg,row.ag].join("|");
      for(let i=0;i<value.length;i++){fingerprint^=value.charCodeAt(i);fingerprint=Math.imul(fingerprint,16777619)>>>0;}
    }
    const signature=[scoredFixtures.length,scoredFixtures[0]?.date,scoredFixtures.at(-1)?.date,fingerprint.toString(16)].join("|");
    if(previous&&previous.version===VERSION&&previous.trainedDay===today&&previous.signature===signature)return previous;
    const scored=[];
    let prior=[];
    for(let i=0;i<scoredFixtures.length;){
      const date=scoredFixtures[i].date;
      let j=i;while(j<scoredFixtures.length&&scoredFixtures[j].date===date)j++;
      if(prior.length>=30){
        for(let k=i;k<j;k++){
          const target=scoredFixtures[k],forecast=forecastFn(target,prior);
          if(!forecast||!forecast.sampleEnough||!forecast.probabilities)continue;
          const actual=Number(target.hg)>Number(target.ag)?"home":Number(target.hg)<Number(target.ag)?"away":"draw";
          scored.push({date,p:normalize(forecast.probabilities),actual});
        }
      }
      prior=prior.concat(scoredFixtures.slice(i,j));
      i=j;
    }
    const split=Math.floor(scored.length*.7),training=scored.slice(0,split),validation=scored.slice(split);
    const base=metrics(validation);
    const fit=training.length?fitTemperature(training):{temperature:1,logLoss:Infinity,brier:Infinity};
    const calibrated=validation.length?loss(validation,fit.temperature):{logLoss:Infinity,brier:Infinity};
    const enough=scored.length>=MIN_SCORED&&validation.length>=MIN_VALIDATION;
    const improvementLL=base.logLoss-calibrated.logLoss,improvementBrier=base.brier-calibrated.brier;
    const approved=Boolean(enough&&fit.temperature!==1&&improvementLL>0.0005&&improvementBrier>0.0005);
    const finalFit=approved?fitTemperature(scored):{temperature:1,logLoss:base.logLoss,brier:base.brier};
    const model={
      version:VERSION,competition:key,trainedDay:today,signature,trainedMatches:scoredFixtures.length,
      scoredForecasts:scored.length,trainingCount:training.length,validationCount:validation.length,
      temperature:approved?finalFit.temperature:1,approved,
      status:approved?"approved":enough?"not_better_than_baseline":"insufficient_sample",
      validation:{baselineLogLoss:base.logLoss,baselineBrier:base.brier,calibratedLogLoss:calibrated.logLoss,calibratedBrier:calibrated.brier,improvementLogLoss:improvementLL,improvementBrier:improvementBrier},
      updatedAt:new Date().toISOString()
    };
    all[key]=model;writeModels(all);return model;
  }
  function explain(match,forecast){
    const reasons=[];
    const home=forecast&&forecast.home,away=forecast&&forecast.away;
    if(home&&away){
      if(home.pointsPerGame>away.pointsPerGame+.25)reasons.push("La squadra di casa ha una media punti recente superiore.");
      else if(away.pointsPerGame>home.pointsPerGame+.25)reasons.push("La squadra ospite ha una media punti recente superiore.");
      if(forecast.homeXg>forecast.awayXg+.25)reasons.push("Il modello stima una produzione offensiva maggiore per la squadra di casa.");
      else if(forecast.awayXg>forecast.homeXg+.25)reasons.push("Il modello stima una produzione offensiva maggiore per la squadra ospite.");
    }
    if(!forecast.sampleEnough)reasons.push("Il campione storico è limitato: la previsione ha affidabilità ridotta.");
    if(forecast.aiCalibration?.applied)reasons.push("La probabilità 1X2 è stata calibrata con un modello adattivo che ha superato il controllo cronologico.");
    if(!reasons.length)reasons.push("I dati disponibili non mostrano un fattore storico dominante.");
    return reasons;
  }
  root.MatchMindAI={version:VERSION,train,modelFor,applyTemperature,fitTemperature,loss,metrics,explain,constants:{minimumScored:MIN_SCORED,minimumValidation:MIN_VALIDATION}};
})(window);

const fs=require('fs'),path=require('path'),vm=require('vm');
const dir=path.join(__dirname,'..','src');
fs.readdirSync(dir).filter(f=>f.endsWith('.js')).sort().forEach(f=>vm.runInThisContext(fs.readFileSync(path.join(dir,f),'utf8'),{filename:f}));
function mk(o){const n=o.order,coeffs=[];for(let k=0;k<=n;k++)coeffs.push(CAS.parse(o.coeffs?(o.coeffs[k]||'0'):'0'));return {order:n,coeffs,rhs:CAS.parse(o.rhs||'0'),hasIC:!!o.ic,x0:o.x0||0,y0s:o.ic||[],knownExpr:o.known?CAS.parse(o.known):null,rawExpr:o.raw?CAS.parse(o.raw):null};}
const cases=[
 ['ord3 trig',{order:3,coeffs:['0','1','0','1']}],
 ['ord3 nonhom',{order:3,coeffs:['0','1','0','1'],rhs:'x+exp(x)'}],
 ['ord5',{order:5,coeffs:['0','0','0','0','-1','1']}],
 ['euler complex',{order:2,coeffs:['1','x','x^2']}],
 ['euler x^2 rhs',{order:2,coeffs:['0','0','x^2'],rhs:'x^4'}],
 ['beta',{order:2,coeffs:['0','1','1'],rhs:'x'}],
 ['exact IC',{order:1,coeffs:['0','x+2*y'],rhs:'-(2*x+y)',ic:[1],x0:1}],
 ['separable tan',{order:1,coeffs:['0','1'],rhs:'(1+y^2)/(1+x^2)'}],
 ['lin tan',{order:1,coeffs:['tan(x)','1'],rhs:'sin(x)'}],
 ['y y prime',{order:1,coeffs:['-1','y'],rhs:'0'}],
 ['resonance x e',{order:2,coeffs:['1','-2','1'],rhs:'x*exp(x)'}],
 ['zero rhs poly',{order:3,coeffs:['0','1','0','1'],rhs:'0'}]
];
for(const [nm,o] of cases){
 try{const r=CAS.solveODE(mk(o));
  console.log('\n###',nm,'|',r.method);
  console.log('  ans:',r.answerHtml.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').slice(0,160));
  if(r.warnings&&r.warnings.length)console.log('  warn:',r.warnings.join('|').slice(0,120));
  if(r.alts&&r.alts.length)console.log('  alts:',r.alts.map(a=>a.label).join(' | '));
 }catch(e){console.log('\n###',nm,'ERROR',e.message);}
}

// Obfuscate a JS snippet read from stdin, print to stdout. Used only for the small licence-gate code.
const O=require((process.env.HG_TOOLS||'/tmp/hg-tools')+'/node_modules/javascript-obfuscator');
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  const r=O.obfuscate(s,{compact:true,controlFlowFlattening:true,controlFlowFlatteningThreshold:0.6,
    stringArray:true,stringArrayThreshold:1,stringArrayEncoding:['base64'],stringArrayCallsTransform:true,
    numbersToExpressions:true,simplify:true,identifierNamesGenerator:'mangled-shuffled',
    renameGlobals:false,selfDefending:false,disableConsoleOutput:false,target:'browser'});
  process.stdout.write(r.getObfuscatedCode());
});

// Obfuscate a JS snippet read from stdin, print to stdout. Used only for the small licence-gate code.
const O=require('/tmp/claude-0/-home-user-huntington-games/b24362dd-7ca5-5fc3-a136-2159b195dcfc/scratchpad/buildtools/node_modules/javascript-obfuscator');
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  const r=O.obfuscate(s,{compact:true,controlFlowFlattening:true,controlFlowFlatteningThreshold:0.6,
    stringArray:true,stringArrayThreshold:1,stringArrayEncoding:['base64'],stringArrayCallsTransform:true,
    numbersToExpressions:true,simplify:true,identifierNamesGenerator:'mangled-shuffled',
    renameGlobals:false,selfDefending:false,disableConsoleOutput:false,target:'browser'});
  process.stdout.write(r.getObfuscatedCode());
});

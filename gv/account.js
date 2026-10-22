/* Grapevine - built by tools/build-gv.sh from gv/*.js. Do not edit. */
!function(t){"use strict";if(!t.HGNet||!t.HGNet.version){var e="1.1.0",i="hgnet1",s=[{url:"wss://mqtt.eclipseprojects.io:443/mqtt",name:"Eclipse"},{url:"wss://public.cloud.shiftr.io:443",name:"Shiftr",username:"public",password:"public"},{url:"wss://broker.emqx.io:8084/mqtt",name:"EMQX"},{url:"wss://broker.hivemq.com:8884/mqtt",name:"HiveMQ"},{url:"wss://test.mosquitto.org:8081/mqtt",name:"Mosquitto"}],n=[{urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]},{urls:"stun:stun.cloudflare.com:3478"},{urls:["turn:eu-0.turn.peerjs.com:3478","turn:us-0.turn.peerjs.com:3478"],username:"peerjs",credential:"peerjsp"}],o={mqtt:["https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js","https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js"],peerjs:["https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js","https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"]},r={payload:32e3,chunkBudget:24e3,incoming:36e3,message:4194304,chunks:256,info:4096,name:32,txWindow:128,rxWindow:512,maxId:999,rtoMax:8e3,sockFast:262144,sockMax:8388608},a={tickMs:100,relayConnectMs:8e3,helloEveryMs:1500,notFoundMs:5e3,joinTimeoutMs:2e4,probeMs:1500,pingRelayMs:2e3,pingSpareMs:5e3,pingDirectMs:1e3,relayFreshMs:7e3,directStallMs:3e3,directTimeoutMs:12e3,lagMs:4e3,reconnectingMs:1e4,dropMs:9e4,giveUpMs:12e4,rejoinMs:12e4,echoMs:1e4,echoTimeoutMs:6e3},h=t.performance&&"function"==typeof t.performance.now?t.performance:null;W.prototype.on=function(t,e){if("function"!=typeof e)return this;var i=this._ev||(this._ev={});return(i[t]||(i[t]=[])).push(e),this},W.prototype.off=function(t,e){var i=this._ev&&this._ev[t];if(!i)return this;if(!e)return delete this._ev[t],this;for(var s=i.length-1;s>=0;s--)i[s]===e&&i.splice(s,1);return this},W.prototype.emit=function(e){var i=this._ev&&this._ev[e];if(i&&i.length){var s=Array.prototype.slice.call(arguments,1);i=i.slice();for(var n=0;n<i.length;n++)try{i[n].apply(this,s)}catch(i){t.console&&t.console.error('[HGNet] error in your "'+e+'" handler:',i)}}};var l={},c=null,u=[],d=null,p={w:void 0,fns:{},next:1},f=/^[a-z0-9]{8,16}$/,g=[192,0],y=[224,0];et.prototype.start=function(t,e,i){this.lib=t,this.topics=e.slice(),this.will=i;for(var s=0;s<this.list.length;s++)this._connect(this.list[s])},et.prototype._attemptMs=function(t){var e=this.net.opts.relayConnectMs;return!t.everUp||null===t.connectMs||this.upCount()>0?e:Math.min(e,Math.max(2500,3*t.connectMs+1500)*Math.min(2,Math.pow(1.4,t.hung)))},et.prototype._connect=function(t){var e=this,i=this.net;if(!this.closed&&!t.client){t.retryAt=0,t.attempts++,t.connectStart=b();var s={placeholder:!0};t.client=s;var n={clientId:"hg"+D(14),clean:!0,protocolVersion:4,connectTimeout:i.opts.relayConnectMs+2e3,reconnectPeriod:0,keepalive:V()?30:90,resubscribe:!1,queueQoSZero:!1,timerVariant:V()?"auto":"native"};t.username&&(n.username=t.username,n.password=t.password||""),this.will&&(n.will={topic:this.will.topic,payload:this.will.payload,qos:0,retain:!1}),K(function(){if(t.client===s&&!e.closed){var i;try{i=e.lib.connect(t.url,n)}catch(i){return t.lastError=String(i&&i.message||i).slice(0,80),t.client=null,void e._failed(t)}t.client=i,i.on("connect",function(){t.client!==i||e.closed||(t.connectMs=Math.round(b()-t.connectStart),e.topics.length?i.subscribe(e.topics,{qos:0},function(s){if(t.client===i&&!e.closed)return s?(t.lastError="subscribe refused",void e._drop(t,i)):void e._markUp(t,i)}):e._markUp(t,i))}),i.on("message",function(s,n){t.client!==i||e.closed||e._onMessage(t,s,n)}),i.on("error",function(e){t.client===i&&(t.lastError=String(e&&e.message||e).slice(0,80))}),i.on("close",function(){t.client===i&&e._drop(t,i)})}})}},et.prototype._markUp=function(t,e){t.up=!0,t.everUp=!0,t.upAt=b(),t.lastError="",t.hung=0,t.lastRx=b(),t.echoOut=null,t.echoMiss=0,t.suspect=!1,t.lastPingReq=b(),this.lastUpAt=b(),this.net._log("relay up: "+t.name+" ("+t.connectMs+" ms)"),this.net._onRelayUp(t)},et.prototype._drop=function(t,e){if(t.client===e&&e){t.client=null;var i=t.up;t.up=!1,t.echoOut=null,function(t,e){t&&!t.placeholder&&K(function(){try{t.end(!e)}catch(t){}})}(e),i?(this.net._log("relay down: "+t.name),this.net._onRelayDown(t)):this.net._log("relay failed: "+t.name+(t.lastError?" ("+t.lastError+")":"")),this._failed(t,i)}},et.prototype._failed=function(t,e){if(!this.closed){var i,s=e&&b()-t.upAt>1e4,n=!this.upCount();s&&(t.failures=0),t.failures++,i=s||t.everUp&&n&&"timed out"===t.lastError?300:t.everUp?Math.min(n?2e3:5e3,500*Math.pow(2,Math.min(t.failures-1,4))):Math.min(3e4,1e3*Math.pow(2,Math.min(t.failures-1,5))),t.retryAt=b()+i*(.75+.5*Math.random()),this.net._onRelayFailed(t)}},et.prototype._onMessage=function(t,e,i){var s=this.net;if(s._tickIfLate(!0),!this.closed)if(!i||i.length>r.incoming)s.stats.malformed++;else{var n=B(i);t.rxBytes+=n.length,t.lastRx=b();var o=tt(n);o?("ec"===o.t?o.f===s.eid&&t.echoOut&&o.n===t.echoOut.n&&(t.rtt=Math.round(b()-t.echoOut.at),t.echoOut=null,t.echoMiss=0,t.suspect=!1):s._onRelayFrame(t,e,o,n.length),s._tickIfLate(!1)):s.stats.malformed++}};var m=null;try{t.TextEncoder&&(m=new t.TextEncoder)}catch(t){m=null}et.prototype.publish=function(t,e,i,s){if(!t||!t.up||!t.client||this.closed)return!1;var n=t.client,o=it(n);if(o){if(o.bufferedAmount>(s?r.sockFast:r.sockMax))return!1;try{o.send(function(t,e){var i,s,n=t.length,o=e.length,r=2+n+o,a=[],h=0;do{s=r%128,(r=Math.floor(r/128))>0&&(s|=128),a.push(s)}while(r>0);var l=new Uint8Array(1+a.length+2+n+o);for(l[h++]=48,i=0;i<a.length;i++)l[h++]=a[i];for(l[h++]=n>>8,l[h++]=255&n,i=0;i<n;i++)l[h++]=255&t.charCodeAt(i);if(m&&m.encodeInto&&o>64)m.encodeInto(e,l.subarray(h));else for(i=0;i<o;i++)l[h++]=255&e.charCodeAt(i);return l}(e,i))}catch(t){return!1}}else K(function(){try{t.client===n&&t.up&&n.publish(e,i,{qos:0,retain:!1})}catch(t){}});return t.txBytes+=i.length,!0},et.prototype._rawControl=function(t,e){var i=it(t.client);if(!i)return!1;try{return i.send(new Uint8Array(e)),!0}catch(t){return!1}},et.prototype.setTopics=function(t,e){var i=this.topics,s=[],n=[],o=this;i.forEach(function(e){t.indexOf(e)<0&&s.push(e)}),t.forEach(function(t){i.indexOf(t)<0&&n.push(t)}),this.topics=t.slice(),this.upList().forEach(function(t){var i=t.client;K(function(){if(t.client===i&&!o.closed){try{s.length&&i.unsubscribe(s)}catch(t){}if(n.length)try{i.subscribe(n,{qos:0},function(s){s||t.client!==i||!e||o.closed||e(t)})}catch(t){}else e&&e(t)}})})},et.prototype.tick=function(t){var e=this.net.opts,i=this;this.list.forEach(function(s){if(!i.closed)if(s.client)if(s.up){if(s.echoOut&&t-s.echoOut.at>e.echoTimeoutMs&&(s.echoOut=null,++s.echoMiss>=(s.suspect?1:2)))return i.net._log("relay "+s.name+" stopped answering - reconnecting it"),s.lastError="stopped answering",void i._drop(s,s.client);!s.echoOut&&t-s.lastRx>e.echoMs&&i._echo(s,t),t-s.lastPingReq>=15e3&&(s.lastPingReq=t,i._rawControl(s,g))}else t-s.connectStart>i._attemptMs(s)&&(s.lastError="timed out",s.hung++,i._drop(s,s.client));else s.retryAt&&t>=s.retryAt&&i._connect(s)})},et.prototype._echo=function(t,e){var i=D(6);t.echoOut={n:i,at:e},this.publish(t,this.net._inbox(),E({v:1,t:"ec",f:this.net.eid,n:i}))},et.prototype.checkNow=function(){var t=b(),e=this;this.upList().forEach(function(i){i.suspect=!0,i.echoOut||e._echo(i,t)})},et.prototype.resetEchoes=function(){this.list.forEach(function(t){t.echoOut=null,t.echoMiss=0,t.lastRx=b()})},et.prototype.retryNow=function(){var t=this,e=b();this.list.forEach(function(i){t.closed||(i.client&&!i.up&&e-i.connectStart>1500&&(i.lastError="timed out",t._drop(i,i.client)),i.client||(i.failures=Math.min(i.failures,1),t._connect(i)))})},et.prototype.upList=function(){for(var t=[],e=0;e<this.list.length;e++)this.list[e].up&&t.push(this.list[e]);return t},et.prototype.upCount=function(){return this.upList().length},et.prototype.everUp=function(){for(var t=0;t<this.list.length;t++)if(this.list[t].everUp)return!0;return!1},et.prototype.allFailed=function(){for(var t=0;t<this.list.length;t++)if(this.list[t].everUp||this.list[t].failures<1)return!1;return!0},et.prototype.settled=function(){for(var t=0;t<this.list.length;t++)if(!this.list[t].everUp&&this.list[t].failures<1)return!1;return!0},et.prototype.close=function(){var t=this;this.closed||(this.closed=!0,this.list.forEach(function(e){var i=e.client,s=it(i);if(e.client=null,e.up=!1,i&&!i.placeholder){if(s)try{s.send(new Uint8Array(y))}catch(t){s=null}K(function(){try{!s&&i.connected&&t.topics.length&&i.unsubscribe(t.topics)}catch(t){}try{i.end(!!s)}catch(t){}})}}))},et.prototype.info=function(){return this.list.map(function(t){return{name:t.name,url:t.url,up:t.up,connectMs:t.connectMs,rtt:t.rtt,error:t.up?"":t.lastError,attempts:t.attempts,txBytes:t.txBytes,rxBytes:t.rxBytes}})};var _={direct:!0},v={direct:!0};st.prototype.rstat=function(t){var e=this.rs[t.idx];return e||(e=this.rs[t.idx]={heard:0,srtt:0,rttvar:0,lastPing:0,gone:!1,loss:0,pingN:0}),e},st.prototype.heard=function(t){var e=b();if(this.lastHeard=e,this.goneAt=0,t.relay){var i=this.rstat(t.relay);i.heard=e,i.gone=!1}else t.direct&&this.direct&&(this.direct.lastHeard=e);this.net._linkHeard(this)},st.prototype.routes=function(t){var e=this.net,i=[],s=[],n=this,o=this.direct;(e.pool?e.pool.upList():[]).forEach(function(o){var r=n.rs[o.idx];r&&!r.gone&&r.heard&&t-r.heard<e.opts.relayFreshMs?i.push(o):s.push(o)}),i.sort(function(t,e){return nt(n,t)-nt(n,e)});var r=this.primary,a=i.indexOf(r);return a>0&&nt(this,r)<=1.3*nt(this,i[0])+40&&(i.splice(a,1),i.unshift(r)),i.length&&(this.primary=i[0]),s.sort(function(t,e){var i=n.rs[t.idx],s=n.rs[e.idx];return(s&&s.heard||0)-(i&&i.heard||0)||t.idx-e.idx}),o&&o.up&&!o.stalled&&i.unshift(_),{fresh:i,spare:s}},st.prototype.pickRoute=function(t,e){var i=this.routes(e),s=i.fresh;return s.length?t>=2&&t%3==2&&i.spare.length&&(s=i.spare,t=Math.floor(t/3)):s=i.spare,s.length?s[t%s.length]:null},st.prototype.rto=function(t){var e,i,s=this.direct;return i=t===_&&s?s.srtt?s.srtt+4*s.rttvar+40:400:t&&void 0!==t.idx&&(e=this.rs[t.idx])&&e.srtt?e.srtt+4*e.rttvar+80:1e3,this.dsrtt&&(i=Math.max(i,this.dsrtt+4*this.drttvar+30)),Math.min(4e3,Math.max(t===_?150:250,i))},st.prototype.rtt=function(){var t=this.direct;if("direct"===this.route&&t&&t.srtt)return Math.round(t.srtt);var e=this.primary,i=e&&this.rs[e.idx];return i&&i.srtt?Math.round(i.srtt):null},st.prototype._wire=function(t,e,i){var s=this,n=this.net;n._impair(function(){if(!s.dead)if(e===_){if(s._directSend(t,i))return;var o=s.routes(b()),r=o.fresh.filter(function(t){return t!==_})[0]||o.spare[0];!r||i&&n.opts.noRelay||n._relaySend(r,s.out,t,i)}else n._relaySend(e,s.out,t,i)})},st.prototype._directSend=function(t,e){var i=this.direct;if(!i||!i.open)return!1;try{e&&i.fast&&"open"===i.fast.readyState?i.fast.bufferedAmount<262144&&i.fast.send(t):i.conn.send(t)}catch(t){return this.closeDirect("send failed"),!1}return this.net.stats.txDirect+=t.length,this.net.stats.txFrames++,!0},st.prototype._ackInto=function(t){this.rxNext>1||this.rxBufN?(t.a=this.rxNext-1,this.rxBufN?t.s=this._sackList():delete t.s):(delete t.a,delete t.s),this.ackPending=!1},st.prototype._sackList=function(){var t=[];for(var e in this.rxBuf)t.push(+e);return t.sort(function(t,e){return t-e}),t.slice(0,32)},st.prototype.sendFrame=function(t,e,i,s){if(this.dead)return null;var n=this.pickRoute(s||0,b());return n&&("data"!==i&&"fast"!==i||!this.net.opts.noRelay||n===_)?(t.v=1,t.f=this.net.eid,this._ackInto(t),this._wire(E(t,e),n,"fast"===i),n):null},st.prototype.sendRaw=function(t,e){this.dead||(t.v=1,t.f=this.net.eid,this._ackInto(t),this._wire(E(t),e.relay||_,!1))},st.prototype.sendData=function(t,e,i,s){if(this.dead)return!1;var n,o=function(t,e,i){var s,n;if(e.length+300<=r.payload){for(s in n={t:t},i)n[s]=i[s];return[{hdr:n,mj:e}]}var o,a=function(t,e){var i,s,n,o=[],r=0,a=0;for(i=0;i<t.length;i++)a+(n=34===(s=t.charCodeAt(i))||92===s?2:s<32?6:1)>e&&(o.push(t.slice(r,i)),r=i,a=0),a+=n;return o.push(t.slice(r)),o}(e,r.chunkBudget),h=[];if(a.length>r.chunks)throw S("too-big","HGNet: message is too big.");for(o=0;o<a.length;o++){if(n={t:t,c:[o,a.length],p:a[o]},0===o)for(s in i)n[s]=i[s];h.push({hdr:n,mj:void 0})}return h}(e?"u":"d",t,i||{}),a=b();if(e){for(s=s||++this.net.fastSeq,n=0;n<o.length;n++)o[n].hdr.q=s,this.sendFrame(o[n].hdr,o[n].mj,"fast",0);return!0}if(this.queue.length+this.unackedN+o.length>2e5)return this.net._log("send queue overflow - message dropped"),!1;for(n=0;n<o.length;n++){var h={q:++this.txSeq,hdr:o[n].hdr,mj:o[n].mj,tries:0,sentAt:0,nextAt:0,via:null};h.hdr.q=h.q,this.queue.push(h)}return this.pump(a),!0},st.prototype.sendCtrl=function(t,e){return this.sendData(q(e),!1,{k:t})},st.prototype.pump=function(t){for(;this.queue.length&&this.unackedN<r.txWindow;){var e=this.queue.shift();this.unacked[e.q]=e,this.unackedN++,this._sendEntry(e,t)}},st.prototype._sendEntry=function(t,e){var i=this.sendFrame(t.hdr,t.mj,"data",t.tries);t.tries>0&&i&&this.net.stats.retransmits++,t.tries++,t.sentAt=e,t.via=i,t.nextAt=i?e+Math.min(r.rtoMax,this.rto(i)*Math.pow(2,Math.min(t.tries-1,4))):e+400},st.prototype._resendVia=function(t){var e=b();U(this.unacked,function(i){i.via===t&&(i.nextAt=e)})},st.prototype.onFrame=function(t,e){if(!this.dead&&(this.heard(e),!this.dead))switch(void 0!==t.a&&this._onAck(t.a,t.s),t.t){case"pi":this.sendRaw({t:"po",n:t.n},e);break;case"po":this._onPong(t,e);break;case"d":this._onData(t);break;case"u":this._onFast(t)}},st.prototype._onPong=function(t,e){if(x(t.n)){var i,s=b()-t.n;if(!(s<0||s>6e4)&&(i=e.relay?this.rstat(e.relay):this.direct)&&(this.lastPong=b(),e.direct&&(i.lastPong=this.lastPong),e.relay&&i.pingN&&t.n===i.pingN&&(i.loss*=.7,i.pingN=0),i.srtt?(i.rttvar=.75*i.rttvar+.25*Math.abs(i.srtt-s),i.srtt=.875*i.srtt+.125*s):(i.srtt=s,i.rttvar=s/2),e.direct&&(!i.up||i.stalled))){i.up=!0,i.stalled=!1,this._routeCheck();var n=b();U(this.unacked,function(t){t.nextAt=Math.min(t.nextAt,n)})}}},st.prototype._onAck=function(t,e){if(j(t,0,this.txSeq)){var i,s=b(),n=!1,o=this,r=0,a=null;for(i in this.unacked)+i<=t&&(c(this.unacked[i]),delete this.unacked[i],this.unackedN--,n=!0);if(P(e)&&e.length<=64&&(e.forEach(function(t){j(t,1,o.txSeq)&&(t>r&&(r=t),o.unacked[t]&&(c(o.unacked[t]),delete o.unacked[t],o.unackedN--,n=!0))}),r)){var h=Math.max(this.rtt()||300,this.dsrtt);U(this.unacked,function(t){t.q<r&&t.tries<8&&s-t.sentAt>1.2*h+30&&o._sendEntry(t,s)})}if(a){var l=Math.min(1e4,s-a.sentAt);this.dsrtt?(this.drttvar=.75*this.drttvar+.25*Math.abs(this.dsrtt-l),this.dsrtt=.875*this.dsrtt+.125*l):(this.dsrtt=l,this.drttvar=l/2)}n&&this.pump(s)}function c(t){1===t.tries&&(!a||t.q>a.q)&&(a=t)}},st.prototype._onData=function(t){var e=t.q;if(j(e,1,1e12))if(function(t){return!(!(void 0!==t.c?ot(t):"m"in t)||void 0!==t.k&&!M(t.k,8)||void 0!==t.to&&"*"!==t.to&&null===I(t.to)||void 0!==t.fr&&null===I(t.fr))}(t)){if(e<this.rxNext||this.rxBuf[e])return this.ackPending=!0,void this._flushAck();if(!(e-this.rxNext>=r.rxWindow)){for(this.rxBuf[e]=t,this.rxBufN++;this.rxBuf[this.rxNext];){var i=this.rxBuf[this.rxNext];if(delete this.rxBuf[this.rxNext],this.rxBufN--,this.rxNext++,this._deliverReliable(i),this.dead)return}this._scheduleAck()}}else this.net.stats.malformed++},st.prototype._deliverReliable=function(t){if(void 0!==t.c){if(!ot(t))return this.rxChunk=null,void this.net.stats.malformed++;var e=t.c[0],i=t.c[1];0===e&&(this.rxChunk={n:i,parts:[],size:0,meta:t});var s=this.rxChunk;if(!s||s.n!==i||s.parts.length!==e)return this.rxChunk=null,void this.net.stats.malformed++;if(s.parts.push(t.p),s.size+=t.p.length,s.size>r.message)return this.rxChunk=null,void this.net.stats.malformed++;if(!(s.parts.length<i)){var n;this.rxChunk=null;try{n=JSON.parse(s.parts.join(""))}catch(t){return void this.net.stats.malformed++}this.net._onLinkMsg(this,s.meta,n,!1)}}else this.net._onLinkMsg(this,t,t.m,!1)},st.prototype._fastFresh=function(t){var e,i=rt(t);return null!==i&&(e=this.fastMax[i]||0,t.q>e||e-t.q>5e4)},st.prototype._onFast=function(t){var e=t.q,i=this.net;if(j(e,1,1e15)&&(void 0===t.x||P(t.x)&&!(t.x.indexOf(i.id)>=0))){if(void 0===t.c){if(!this._fastFresh(t))return;return this.fastMax[rt(t)]=e,void i._onLinkMsg(this,t,t.m,!0)}if(ot(t)){var s,n=this.fastParts[e];if(!n)for(n=this.fastParts[e]={n:t.c[1],got:0,parts:[],size:0,meta:null},s=Object.keys(this.fastParts).map(Number).sort(function(t,e){return t-e});s.length>3;)delete this.fastParts[s.shift()];if(n.n===t.c[1]&&void 0===n.parts[t.c[0]])if(n.parts[t.c[0]]=t.p,n.got++,n.size+=t.p.length,0===t.c[0]&&(n.meta=t),n.size>r.message)delete this.fastParts[e];else if(!(n.got<n.n)){delete this.fastParts[e];var o=n.meta||t;if(this._fastFresh({q:e,fr:o.fr})){var a;this.fastMax[rt(o)]=e;try{a=JSON.parse(n.parts.join(""))}catch(t){return void i.stats.malformed++}i._onLinkMsg(this,o,a,!0)}}}else i.stats.malformed++}},st.prototype._scheduleAck=function(){var t=this;this.ackPending=!0,L()?this._flushAck():this.ackTimer||(this.ackTimer=setTimeout(function(){t.ackTimer=null,t._flushAck()},15))},st.prototype._flushAck=function(){this.ackPending&&!this.dead&&this.sendFrame({t:"a"},void 0,"ack",0)},st.prototype.tick=function(t){if(!this.dead){var e=this;U(this.unacked,function(i){i.nextAt<=t&&!e.dead&&e._sendEntry(i,t)}),this._pings(t),this._directHealth(t),this.ackPending&&this._flushAck()}},st.prototype._pings=function(t){var e,i,s,n,o=this.net,r=o.pool?o.pool.upList():[],a=this.direct;for(this.routes(t),e=0;e<r.length;e++)i=r[e],s=this.rstat(i),(!o.isHost||s.heard&&t-s.heard<3e4)&&(n=i===this.primary?o.opts.pingRelayMs:o.opts.pingSpareMs,t-s.lastPing>=n&&(s.pingN&&!L()&&t-s.lastPing<3*n&&(s.loss=.7*s.loss+.3),s.lastPing=t,s.pingN=H(t),this.sendRaw({t:"pi",n:s.pingN},{relay:i})));a&&a.open&&t-a.lastPing>=o.opts.pingDirectMs&&(a.lastPing=t,this.sendRaw({t:"pi",n:H(t)},v))},st.prototype._directHealth=function(t){var e=this.direct,i=this.net.opts;e&&(e.up&&!e.stalled&&t-e.lastPong>i.directStallMs&&(e.stalled=!0,this.net._log("direct link to "+this.eid+" stalled - using the relay"),this._routeCheck(),this._resendVia(_)),!e.up&&t-e.startedAt>i.directTimeoutMs?this.closeDirect("timed out"):e.stalled&&t-e.lastPong>3e4&&this.closeDirect("dead"))},st.prototype._routeCheck=function(){var t=this.direct,e=t&&t.up&&!t.stalled?"direct":"relay";e!==this.route&&(this.route=e,this.net._onRoute(this,e))},st.prototype.relayDown=function(t){var e=this.rs[t.idx];e&&(e.heard=0,e.pingN=0),this.primary===t&&(this.primary=null),this._resendVia(t)},st.prototype.relayGone=function(t){var e=this.rstat(t),i=b();e.gone=!0,e.heard=0,this.primary===t&&(this.primary=null),this._resendVia(t),this.routes(i).fresh.length||(this.goneAt=i)},st.prototype.closeDirect=function(t){var e=this.direct;if(e){this.direct=null;try{e.fast&&e.fast.close()}catch(t){}try{e.conn.close()}catch(t){}this.net._log("direct link to "+this.eid+" closed ("+t+")"),this._routeCheck(),this._resendVia(_),this.net._directClosed(this,e)}},st.prototype.backlog=function(){return this.queue.length+this.unackedN},st.prototype.resendAll=function(){var t=b();U(this.unacked,function(e){e.tries=0,e.nextAt=Math.min(e.nextAt,t)})},st.prototype.destroy=function(){this.dead||(this.closeDirect("link closed"),this.dead=!0,clearTimeout(this.ackTimer),this.unacked={},this.unackedN=0,this.queue=[],this.rxBuf={},this.fastParts={})},at.prototype.enabled=function(){var e=this.net.opts;return!e.forceRelay&&!1!==e.peer&&"function"==typeof t.RTCPeerConnection},at.prototype.start=function(){var t=this,e=this.net;this.enabled()&&"idle"===this.state&&!e.closed&&(this.state="loading",$(e.opts).then(function(i){e.closed||"loading"!==t.state||t._open(i)},function(){t._fail("PeerJS could not be loaded")}))},at.prototype._open=function(t){var e,i=this,s=this.net,n=s.opts,o=n.peer||{},r={debug:0,config:{iceServers:n.iceServers}};o.host&&(r.host=o.host),o.port&&(r.port=o.port),o.path&&(r.path=o.path),void 0!==o.secure&&(r.secure=!!o.secure),o.key&&(r.key=o.key);try{e=new t("hgn-"+(s.game.replace(/[^a-z0-9]/g,"")||"game")+"-"+D(12),r)}catch(t){return void this._fail("PeerJS error: "+(t&&t.message))}this.peer=e,this.state="connecting";var a=setTimeout(function(){i.peer===e&&"connecting"===i.state&&i._fail("signalling server timed out")},15e3);e.on("open",function(t){i.peer===e&&(clearTimeout(a),i.state="open",i.id=t,i.fails=0,s._log("WebRTC signalling ready"),s._onDirectReady(t))}),e.on("connection",function(t){if(i.peer===e)s._onDirectIncoming(t);else try{t.close()}catch(t){}}),e.on("disconnected",function(){i.peer!==e||s.closed||setTimeout(function(){if(i.peer===e&&!e.destroyed&&e.disconnected)try{e.reconnect()}catch(t){}},3e3)}),e.on("error",function(t){if(i.peer===e){var n=t&&t.type;s._log("WebRTC: "+(n||t)),"peer-unavailable"!==n?"connecting"===i.state&&(clearTimeout(a),i._fail(n||"error")):s._onDirectUnavailable(t)}})},at.prototype._fail=function(t){var e=this;if(this.net._log("WebRTC unavailable: "+t),this.peer)try{this.peer.destroy()}catch(t){}this.peer=null,this.id=null,this.state="failed",this.fails++,this.fails<=2&&!this.net.closed&&(this.retry=setTimeout(function(){"failed"===e.state&&(e.state="idle",e.start())},3e4*this.fails))},at.prototype.close=function(){if(clearTimeout(this.retry),this.peer)try{this.peer.destroy()}catch(t){}this.peer=null,this.id=null,this.state="closed"},ht.prototype=new W,ht.prototype.constructor=ht,ht.prototype._log=function(e){var i=(this.isHost?"host":"guest")+" "+e;this._logs.push(Math.round(b())+" "+i),this._logs.length>300&&this._logs.shift();var s=this.opts.log;if(!0===s&&t.console)t.console.log("[HGNet] "+i);else if("function"==typeof s)try{s(i)}catch(t){}},ht.prototype._status=function(t){this.statusText=t,this._log("status: "+t),this.emit("status",t)},ht.prototype._impair=function(t){var e=this.opts;e.dropRate>0&&Math.random()<e.dropRate?this.stats.impairDropped++:e.latency>0||e.jitter>0?setTimeout(t,e.latency+Math.random()*e.jitter):t()},ht.prototype.setImpairment=function(t){void 0!==(t=t||{}).dropRate&&(this.opts.dropRate=T(t.dropRate,0,1,0)),void 0!==t.latency&&(this.opts.latency=T(t.latency,0,2e4,0)),void 0!==t.jitter&&(this.opts.jitter=T(t.jitter,0,2e4,0))},ht.prototype._base=function(){return i+"/"+this.game+"/"+this.code+"/"},ht.prototype._inbox=function(){return this._base()+"g/"+this.eid},ht.prototype._relaySend=function(t,e,i,s){return!(!this.pool||!this.pool.publish(t,e,i,s))&&(this.stats.txRelay+=i.length,this.stats.txFrames++,!0)},ht.prototype._publishRaw=function(t,e,i){var s=this;i.v=1,i.f=this.eid;var n=E(i);this._impair(function(){s._relaySend(t,e,n)})},ht.prototype._startPool=function(e,i){var s=this;this.pool=new et(this),this._stopTick=Y(this.opts.tickMs,function(){s._tick()}),t.addEventListener&&(t.addEventListener("pagehide",this._onPageHide),t.addEventListener("online",this._onOnline)),t.document&&t.document.addEventListener&&t.document.addEventListener("visibilitychange",this._onVisible),this.opts.relays.length?z(this.opts).then(function(t){s.closed||s.pool.start(t,e,i)},function(){s._fail("blocked","Couldn't load the online-play code - your network may be blocking cdn.jsdelivr.net. Try another network.")}):this._log("no relays configured")},ht.prototype._relayCountText=function(){var t=this.pool?this.pool.upCount():0,e=this.opts.relays.length;return t+" of "+e+" game server"+(1===e?"":"s")},ht.prototype._onRelayUp=function(t){var e=b();if("connecting"===this.state&&this.isHost)this._status("Connected to "+this._relayCountText()+"..."),this._probe&&this._sendProbe(t);else if("joining"===this.state)this._status("Looking for game "+this.code+"..."),this._sendHello(t,!1),this._joinReq.firstHello||(this._joinReq.firstHello=e);else if(this._rejoin)this._sendHello(t,!0);else if("hosting"===this.state){if(this._offlineAt){var i=e-this._offlineAt;this._offlineAt=0,this._log("back online after "+Math.round(i/1e3)+" s without any game server"),U(this.links,function(t){t.lastHeard=Math.min(e,t.lastHeard+i)}),U(this.tombs,function(t){t.until+=i})}this._status("Room "+this.code+" is open on "+this._relayCountText())}U(this.links,function(e){var i=e.rstat(t);i.lastPing=0,i.gone=!1}),!this.isHost&&this.hostLink&&(this.hostLink.rstat(t).lastPing=0),"reconnecting"!==this.state&&"joined"!==this.state||this.hostLink&&this.hostLink._pings(e)},ht.prototype._onRelayDown=function(t){U(this.links,function(e){e.relayDown(t)}),this.hostLink&&this.hostLink.relayDown(t),!this.isHost||"hosting"!==this.state||this.pool.upCount()||this._offlineAt||(this._offlineAt=b(),this._status("Lost the connection to the game servers - reconnecting..."))},ht.prototype._onRelayFailed=function(){},ht.prototype._onRelayFrame=function(t,e,i,s){if(!this.closed&&i.f!==this.eid){this.stats.rxRelay+=s,this.stats.rxFrames++,this._lastRxAt=b();var n={relay:t,topic:e};this.isHost?this._hostFrame(i,n):this._guestFrame(i,n)}},ht.prototype._onDirectData=function(t,e){if(this._tickIfLate(!0),!this.closed&&!t.dead){if("string"!=typeof e)try{e=B(e)}catch(t){return}var i=tt(e);i&&i.f===t.eid?(this.stats.rxDirect+=e.length,this.stats.rxFrames++,this._lastRxAt=b(),this.isHost||"by"!==i.t?this.isHost&&"by"===i.t?this._hostFrame(i,v):(this.isHost&&(t.gotData=!0),t.onFrame(i,v),this._tickIfLate(!1)):this._guestFrame(i,v)):this.stats.malformed++}},ht.prototype._onLinkMsg=function(t,e,i,s){if(!this.closed)if(void 0===i&&(i=null),void 0===e.k){if(this.isHost){var n=t.peer,o=e.to;if(!n)return;return void 0===o||0===o?void this.emit("message",n.pub,i,{fast:s,to:"host"}):"*"===o?(this.opts.guestToGuest&&this._hostDeliver("all",q(i),s,n.id,[n.id]),void this.emit("message",n.pub,i,{fast:s,to:"all"})):void(null!==(o=I(o))&&this.opts.guestToGuest&&this.peerRecs[o]&&o!==n.id&&this._hostDeliver(o,q(i),s,n.id))}var r,a=e.fr;void 0===a||0===a?r=this.hostPub:null!==I(a)&&(r=this.peerRecs[a]?this.peerRecs[a].pub:lt(a,"Player "+a,null,!1)),r&&this.emit("message",r,i,{fast:s})}else!s&&M(e.k,8)&&this._onCtrl(t,e.k,i)},ht.prototype.host=function(t){var e=this;if("idle"!==this.state)return Promise.reject(S("busy","This HGNet connection is already in use - make a new one with HGNet.create()."));var i=void 0===(t=t||{}).info?null:t.info;if(F(i)>r.info)return Promise.reject(S("too-big","HGNet: room info must be under 4 KB."));this.isHost=!0,this.id=0,this.state="connecting",this.room={name:O(t.name,"Host"),maxPlayers:Math.round(T(t.maxPlayers,2,64,8)),info:i,accept:"function"==typeof t.accept?t.accept:null},this.tombs={},this._pending={},this._nkAt={},this._gone={},this._rosterDirty=!1,this._offlineAt=0,this._roomKey=D(12),this.hostInfo={name:this.room.name,info:i,maxPlayers:this.room.maxPlayers},this._hostStart=b(),this._codeTries=0;var s=new Promise(function(t,i){e._hostP={resolve:t,reject:i}});return this._newCode(t.code&&/^\d{6}$/.test(String(t.code))?String(t.code):null),this._status("Connecting to game servers..."),this._startPool(this._hostTopics(),this._hostWill()),s},ht.prototype._hostTopics=function(){return[this._base()+"h",this._inbox()]},ht.prototype._hostWill=function(){return{topic:this._base()+"b",payload:E({v:1,t:"gn",f:this.eid})}},ht.prototype._newCode=function(t){var e=this;this._codeTries++,this.code=t||String(1e5+A(9e5)),this._probe={nonce:D(10),firstAt:0},this._log("trying code "+this.code),this.pool&&(this.pool.will=this._hostWill()),this.pool&&this.pool.lib&&this.pool.setTopics(this._hostTopics(),function(t){e._sendProbe(t)})},ht.prototype._sendProbe=function(t){this._probe&&(this._probe.firstAt||(this._probe.firstAt=b()),this._publishRaw(t,this._base()+"h",{t:"pr",n:this._probe.nonce}))},ht.prototype._codeTaken=function(){this._log("code "+this.code+" is already in use"),this._codeTries>=10?this._fail("busy","Could not find a free game code - please try again."):this._newCode(null)},ht.prototype._serve=function(){if(this._probe=null,this.state="hosting",this._status("Room "+this.code+" is open on "+this._relayCountText()),this._hostP){var t=this._hostP;this._hostP=null,t.resolve({code:this.code})}this.direct.start()},ht.prototype._hostFrame=function(t,e){var i;switch(t.t){case"pr":return void("hosting"===this.state?e.relay&&this._publishRaw(e.relay,this._base()+"g/"+t.f,{t:"tk",n:t.n}):this._probe&&M(t.n,12)&&t.n<this._probe.nonce&&this._codeTaken());case"tk":return void(this._probe&&t.n===this._probe.nonce&&this._codeTaken());case"he":return void this._onHello(t,e);case"gn":return void((i=this.links[t.f])&&e.relay&&i.relayGone(e.relay));case"by":if((i=this.links[t.f])&&i.peer){if(i.peer.keyed&&i.gotData&&t.k!==i.peer.key)return void this.stats.malformed++;this._removePeer(i.peer,"left",!0)}else this._pending[t.f]&&(this._pending[t.f].cancelled=!0,delete this._pending[t.f]),this._markGone(t.f);return;default:if(i=this.links[t.f])return i.gotData=!0,void i.onFrame(t,e);"pi"!==t.t&&"d"!==t.t&&"u"!==t.t&&"a"!==t.t||!e.relay||"hosting"!==this.state||this._notKnown(t.f,e.relay)}},ht.prototype._notKnown=function(t,e){var i=b(),s=this;this._nkAt[t]&&i-this._nkAt[t]<1e3||(Object.keys(this._nkAt).length>200&&U(this._nkAt,function(t,e){i-t>5e3&&delete s._nkAt[e]}),Object.keys(this._nkAt).length>200||(this._nkAt[t]=i,this._publishRaw(e,this._base()+"g/"+t,{t:"nk"})))},ht.prototype._guestCount=function(){return Object.keys(this.peerRecs).length},ht.prototype._markGone=function(t){var e=b(),i=this;Object.keys(this._gone).length>=500&&U(this._gone,function(t,s){e-t>1e4&&delete i._gone[s]}),Object.keys(this._gone).length<1e3&&(this._gone[t]=e)},ht.prototype._linkAlive=function(t,e){return!!t&&!t.dead&&!t.goneAt&&e-t.lastHeard<3e3},ht.prototype._peerByToken=function(t){var e=null;return U(this.peerRecs,function(i){i.token===t&&(e=i)}),e},ht.prototype._freeId=function(){var t,e={};for(U(this.peerRecs,function(t){e[t.id]=!0}),U(this.tombs,function(t){e[t.id]=!0}),t=1;t<=r.maxId;t++)if(!e[t])return t;return null},ht.prototype._onHello=function(t,e){var i=this,s=b(),n=t.f;if("hosting"===this.state&&e.relay)if((void 0===t.n||M(t.n,64))&&(void 0===t.tk||M(t.tk,40)&&/^[a-z0-9]{8,40}$/.test(t.tk))){var o=void 0===t.i?null:t.i;if(F(o)>r.info)this.stats.malformed++;else{var a=O(t.n,"Player"),h=t.tk||null,l=this.links[n];if(!(this._gone[n]&&s-this._gone[n]<6e4)){if(l&&l.peer)return l.heard(e),l.peer.keyed=!!t.kv,void this._sendWelcome(l.peer,e.relay);if(this._pending[n])this._publishRaw(e.relay,this._base()+"g/"+n,{t:"wt"});else{var c=this._guestCount()>=this.room.maxPlayers-1,u="That game is full ("+this.room.maxPlayers+"/"+this.room.maxPlayers+" players).";if(h){var d=this._peerByToken(h),p=this.tombs[h];if(d&&!t.rj&&this._linkAlive(d.link,s))this._log("token of #"+d.id+" is in use by a live connection");else{if(d)return d.keyed=!!t.kv,void this._replaceLink(d,n,e);if(p&&p.until>s)return c?void this._deny(n,e.relay,"full",u):(delete this.tombs[h],void this._admit(n,e,{id:p.id,token:h,key:p.key,name:a,info:o,rejoin:!0,keyed:!!t.kv}));if(t.rj)return void this._deny(n,e.relay,"expired","You were away too long and lost your place - join again with the code.")}}if(c)this._deny(n,e.relay,"full",u);else{var f=this.room.accept;if(f){var g=this._pending[n]={at:s,cancelled:!1};this._publishRaw(e.relay,this._base()+"g/"+n,{t:"wt"});var y=!1,m=function(s){y||(y=!0,i._pending[n]===g&&delete i._pending[n],g.cancelled||i.closed||"hosting"!==i.state||i.links[n]||(!0===s||null==s?i._guestCount()>=i.room.maxPlayers-1?i._deny(n,e.relay,"full",u):i._admit(n,e,{name:a,info:o,keyed:!!t.kv}):i._deny(n,e.relay,"refused","string"==typeof s&&s?s.slice(0,200):"The host didn't let you join this game.")))};try{var _=f({name:a,info:o});_&&"function"==typeof _.then?_.then(m,function(){m(!1)}):m(_)}catch(t){this._log("accept() threw: "+t),m(!1)}}else this._admit(n,e,{name:a,info:o,keyed:!!t.kv})}}}}}else this.stats.malformed++},ht.prototype._deny=function(t,e,i,s){this._log("refused a join ("+i+")"),this._publishRaw(e,this._base()+"g/"+t,{t:"dn",w:i,x:s})},ht.prototype._sendWelcome=function(t,e){var i={t:"wl",id:t.id,tk:t.token,bk:t.key,rk:this._roomKey,hn:this.room.name,hi:this.room.info,mx:this.room.maxPlayers};this.direct.id&&(i.pj=this.direct.id),t.rejoin&&(i.rj=1),this._publishRaw(e,this._base()+"g/"+t.eid,i)},ht.prototype._admit=function(t,e,i){var s=i.id||this._freeId();if(null!==s){var n=new st(this,t,this._base()+"g/"+t),o=lt(s,i.name,i.info,!1),r={id:s,eid:t,token:i.token||D(20),key:i.key||D(12),keyed:!!i.keyed,name:i.name,info:i.info,link:n,pub:o,lagging:!1,reconnecting:!1,rejoin:!!i.rejoin,joinedAt:Date.now()};o.rejoin=!!i.rejoin,n.peer=r,this.links[t]=n,this.peerRecs[s]=r,n.heard(e),this._sendWelcome(r,e.relay),this._log((i.rejoin?"rejoined: ":"joined: ")+i.name+" as #"+s),this._flushRoster(["j",s]),this._status(i.name+(i.rejoin?" rejoined":" joined")),this.emit("join",o)}else this._deny(t,e.relay,"full","That game is full.")},ht.prototype._replaceLink=function(t,e,i){var s=t.link;s&&(delete this.links[s.eid],s.destroy(),this._markGone(s.eid));var n=new st(this,e,this._base()+"g/"+e);n.peer=t,t.link=n,t.eid=e,t.rejoin=!0,this.links[e]=n,n.heard(i);var o=t.lagging;t.lagging=t.reconnecting=!1,t.pub.lagging=!1,t.pub.state="connected",t.pub.route="relay",t.pub.rejoin=!0,this._sendWelcome(t,i.relay),this._log("player #"+t.id+" is back with a fresh connection"),this._flushRoster(null),o&&this.emit("lagging",t.pub,!1),this.emit("reconnected",t.pub,{rejoin:!0})},ht.prototype._removePeer=function(t,e,i){this.peerRecs[t.id]===t&&(delete this.peerRecs[t.id],delete this.links[t.eid],t.link.destroy(),this._markGone(t.eid),i&&(this.tombs[t.token]={id:t.id,name:t.name,key:t.key,until:b()+this.opts.rejoinMs}),t.pub.state="left",this._log("left: #"+t.id+" ("+e+")"),this._flushRoster(["l",t.id,e]),this._status(t.name+" left"),this.emit("leave",t.pub,e))},ht.prototype._roster=function(){var t=[[0,this.room.name,this.room.info,0]];return U(this.peerRecs,function(e){t.push([e.id,e.name,e.info,e.reconnecting?2:e.lagging?1:0])}),t},ht.prototype._flushRoster=function(t){this._rosterDirty=!1;var e={l:this._roster()};t&&(e.e=t);var i=q(e);U(this.peerRecs,function(t){t.link.sendData(i,!1,{k:"ro"})})},ht.prototype._hostTick=function(t){var e=this.opts,i=this;if("connecting"===this.state){var s=t-this._hostStart;return this.pool.everUp()?void(this._probe&&this._probe.firstAt&&t-this._probe.firstAt>=e.probeMs&&this._serve()):void((this.pool.allFailed()&&s>3e3||s>e.relayConnectMs+3e3)&&this._failBlocked())}"hosting"===this.state&&(U(this.peerRecs,function(s){if(!i.closed&&i.peerRecs[s.id]===s){var n=s.link,o=t-n.lastHeard;n.goneAt&&t-n.goneAt>2e3&&(o=Math.max(o,e.reconnectingMs+1)),!s.lagging&&o>e.lagMs&&(s.lagging=!0,s.pub.lagging=!0,s.pub.state="lagging",i._rosterDirty=!0,i.pool.checkNow(),i.emit("lagging",s.pub,!0)),s.lagging&&!s.reconnecting&&o>e.reconnectingMs&&(s.reconnecting=!0,s.pub.state="reconnecting",i._rosterDirty=!0,i._log("#"+s.id+" silent for "+Math.round(o/1e3)+" s - reconnecting"),i.emit("reconnecting",s.pub)),t-n.lastHeard>e.dropMs&&!i._offlineAt?i._removePeer(s,"timeout",!0):n.goneAt&&!n.gotData&&t-n.goneAt>3e3&&!i._offlineAt?i._removePeer(s,"left",!0):(s.pub.route=n.route,s.pub.rtt=n.rtt())}}),this._offlineAt||U(this.tombs,function(e,s){e.until<t&&delete i.tombs[s]}),U(this._pending,function(e,s){t-e.at>12e4&&delete i._pending[s]}),U(this._gone,function(e,s){t-e>6e4&&delete i._gone[s]}),this._rosterDirty&&!this.closed&&this._flushRoster(null))},ht.prototype.join=function(e,i){var s=this;if(e=C(e),!/^\d{6}$/.test(e))return Promise.reject(S("bad-code","Game codes are 6 digits - check the code with the host."));if("idle"!==this.state)return Promise.reject(S("busy","This HGNet connection is already in use - make a new one with HGNet.create()."));var n=void 0===(i=i||{}).info?null:i.info;if(F(n)>r.info)return Promise.reject(S("too-big","HGNet: player info must be under 4 KB."));this.code=e,this.state="joining",this.token="string"==typeof i.token&&/^[a-z0-9]{8,40}$/.test(i.token)?i.token:this.opts.resume?function(e,i){try{var s=t.sessionStorage.getItem(Z(e,i));return s&&/^[a-z0-9]{8,40}$/.test(s)?s:null}catch(t){return null}}(this.game,e):null,this._joinReq={name:O(i.name,"Player"),info:n,startedAt:b(),firstHello:0,lastHello:0,hostSeen:!1},this.hostLink=null,this.hostPub=null,this._reconnecting=!1,this._hostLagging=!1,this._rejoin=null,this._keys=null;var o=new Promise(function(t,e){s._joinP={resolve:t,reject:e}});return this._status("Connecting to game servers..."),this._startPool([this._inbox(),this._base()+"b"],this._guestWill()),o},ht.prototype._sendHello=function(t,i){var s=this._joinReq,n={t:"he",n:s.name,pv:e,kv:1};null!==s.info&&(n.i=s.info),this.token&&(n.tk=this.token),i&&(n.rj=1),this._publishRaw(t,this._base()+"h",n)},ht.prototype._guestFrame=function(t,e){var i=t.t;if(!e.relay||e.topic===this._inbox()||e.topic===this._base()+"b")if("joining"!==this.state){var s=this.hostLink;if(s&&t.f===s.eid)switch(i){case"by":return this._keys&&(!M(t.k,16)||t.k!==this._keys.g&&t.k!==this._keys.r)?void this.stats.malformed++:void("kicked"===t.w?this._shutdown("kicked",M(t.x,200)&&t.x?t.x:"The host removed you from the game."):this._shutdown("host-left","The host left the game."));case"gn":return void(e.relay&&s.relayGone(e.relay));case"nk":return void(b()-s.lastPong>3e3&&this._startRejoin());case"wl":return void(this._rejoin?this._onWelcome(t,e):s.heard(e));case"dn":return void(this._rejoin&&this._shutdown("lost",M(t.x,200)&&t.x?t.x:"Could not get back into the game."));case"wt":return;default:s.onFrame(t,e)}}else"wl"===i?this._onWelcome(t,e):"dn"===i?this._onDenied(t):"wt"===i&&(this._joinReq.hostSeen=!0)},ht.prototype._onWelcome=function(e,i){if(j(e.id,1,r.maxId)&&M(e.tk,40)&&/^[a-z0-9]{8,40}$/.test(e.tk)&&(!this.hostLink||this.hostLink.eid===e.f)){var s=this,n=!!this._rejoin;if(n&&e.id!==this.id)this._shutdown("lost","You were away too long and lost your place - join again with the code.");else{if(this.hostLink&&this.hostLink.destroy(),this.hostLink=new st(this,e.f,this._base()+"h"),this.id=e.id,this.token=e.tk,this.opts.resume&&function(e,i,s){try{t.sessionStorage.setItem(Z(e,i),s)}catch(t){}}(this.game,this.code,e.tk),this.hostInfo={name:O(e.hn,"Host"),info:void 0===e.hi?null:e.hi,maxPlayers:j(e.mx,2,64)?e.mx:null},this.hostPub||(this.hostPub=lt(0,this.hostInfo.name,this.hostInfo.info,!0)),M(e.pj,64)&&(this.hostLink.remotePj=e.pj),this.hostLink.lastPong=b(),/^[a-z0-9]{8,16}$/.test(e.bk)&&/^[a-z0-9]{8,16}$/.test(e.rk)&&(this._keys={g:e.bk,r:e.rk}),this.hostLink.heard(i),n)return this._rejoin=null,this._reconnecting=!1,this.state="joined",this.hostPub.state="connected",this.hostPub.lagging=!1,this.hostPub.route="relay",this._hostLagging&&(this._hostLagging=!1,this.emit("lagging",this.hostPub,!1)),this._status("Back in the game"),this.emit("reconnected",void 0,{rejoin:!0}),void this._maybeDirect();this.state="joined",this._status("Joined game "+this.code+" (via game server)");var o=this._joinP;this._joinP=null,o.resolve({id:this.id,hostInfo:this.hostInfo,code:this.code,rejoined:!!e.rj}),Promise.resolve().then(function(){s.closed||s.emit("join",s.hostPub)}),this.direct.start()}}},ht.prototype._onDenied=function(t){var e="full"===t.w?"full":"refused";this._fail(e,M(t.x,200)&&t.x?t.x:"full"===e?"That game is full.":"The host didn't let you join this game.")},ht.prototype._startRejoin=function(){var t=this;if(!this._rejoin&&!this.closed&&this.token){if(this._log("host no longer knows us - rejoining with our token"),this._rejoin={at:b(),lastHello:0},this._setReconnecting(),this.hostLink){var e=this.hostLink.lastHeard,i=this.hostLink.eid;this.hostLink.destroy(),this.hostLink=new st(this,i,this._base()+"h"),this.hostLink.lastHeard=e,this.hostLink.dead=!0}this.eid=D(12),this.pool.will=this._guestWill(),this.pool.setTopics([this._inbox(),this._base()+"b"],function(e){t._sendHello(e,!0)})}},ht.prototype._guestWill=function(){return{topic:this._base()+"h",payload:E({v:1,t:"gn",f:this.eid})}},ht.prototype._setReconnecting=function(){this._reconnecting||(this._reconnecting=!0,this.state="reconnecting",this.hostPub&&(this.hostPub.state="reconnecting"),this._status("Connection lost - reconnecting..."),this.pool&&(this.pool.retryNow(),this.pool.checkNow()),this.emit("reconnecting"))},ht.prototype._guestTick=function(t){var e=this.opts,i=this._joinReq,s=this.pool;if("joining"!==this.state){if("joined"===this.state||"reconnecting"===this.state){var n=this.hostLink,o=t-n.lastHeard,r=n.direct,a=r&&r.up&&!r.stalled,h=!s.upCount()&&!a;if(!this._hostLagging&&(o>e.lagMs||h&&o>1500)&&(this._hostLagging=!0,this.hostPub.lagging=!0,s.checkNow(),this.emit("lagging",this.hostPub,!0)),!this._reconnecting&&(o>e.reconnectingMs||(h||n.goneAt)&&o>2e3)&&this._setReconnecting(),this._reconnecting&&t-(this._lastCheck||0)>3e3&&(this._lastCheck=t,s.checkNow()),this._rejoin&&t-this._rejoin.lastHello>=e.helloEveryMs){var l=this;this._rejoin.lastHello=t,s.upList().forEach(function(t){l._sendHello(t,!0)})}if(o>e.giveUpMs)this._shutdown("lost","Lost the connection to the host.");else{this.hostPub.route=n.route,this.hostPub.rtt=n.rtt();var c=this;U(this.peerRecs,function(t){t.pub.route=c.hostPub.route}),this._maybeDirect()}}}else{var u=s.upList(),d=t-i.startedAt,p=this;if(u.length&&t-i.lastHello>=e.helloEveryMs&&(i.lastHello=t,i.firstHello||(i.firstHello=t),u.forEach(function(t){p._sendHello(t,!1)})),s.everUp())if(i.hostSeen)d>9e4&&this._fail("timeout","The host did not let you in in time.");else{var f=s.settled()&&t-s.lastUpAt>2e3;(i.firstHello&&t-i.firstHello>e.notFoundMs&&f||d>e.joinTimeoutMs)&&this._fail("not-found","No game with code "+this.code+" - check the digits with the host.")}else(s.allFailed()&&d>3e3||d>e.relayConnectMs+3e3)&&this._failBlocked()}},ht.prototype._onRoster=function(t){if(R(t)&&P(t.l)&&!(t.l.length>128)){var e=this,i={},s=[],n=P(t.e)?t.e:null;t.l.forEach(function(t){if(P(t)&&j(t[0],0,r.maxId)){var n=t[0],o=O(t[1],0===n?"Host":"Player "+n),a=void 0===t[2]?null:t[2],h=j(t[3],0,2)?t[3]:0;if(i[n]=!0,0!==n){if(n!==e.id){var l=e.peerRecs[n];if(!l)return(l=e.peerRecs[n]={id:n,name:o,info:a,st:h,pub:lt(n,o,a,!1)}).pub.lagging=h>0,l.pub.state=2===h?"reconnecting":1===h?"lagging":"connected",l.pub.route=e.hostPub?e.hostPub.route:"relay",void s.push(l.pub);if(l.name=l.pub.name=o,l.info=l.pub.info=a,h!==l.st){var c=l.st;l.st=h,l.pub.lagging=h>0,l.pub.state=2===h?"reconnecting":1===h?"lagging":"connected",0===c&&e.emit("lagging",l.pub,!0),2===h&&e.emit("reconnecting",l.pub),0===h&&(e.emit("lagging",l.pub,!1),2===c&&e.emit("reconnected",l.pub,{rejoin:!1}))}}}else e.hostPub&&(e.hostPub.name=o,e.hostPub.info=a)}}),U(this.peerRecs,function(t,s){if(!i[s]){delete e.peerRecs[s],t.pub.state="left";var o=n&&"l"===n[0]&&n[1]===t.id&&M(n[2],16)?n[2]:"left";e.emit("leave",t.pub,o)}}),s.forEach(function(t){e.emit("join",t)})}},ht.prototype._onCtrl=function(t,e,i){this.isHost?"rtc"===e&&R(i)&&M(i.pj,64)&&(t.remotePj=i.pj):"ro"===e?this._onRoster(i):"rtc"===e&&R(i)&&M(i.pj,64)&&(t.remotePj=i.pj,t.directTries=0,t.nextDirectAt=0,this._maybeDirect())},ht.prototype._onDirectReady=function(t){this.isHost?U(this.peerRecs,function(e){e.link.sendCtrl("rtc",{pj:t})}):this._maybeDirect()},ht.prototype._maybeDirect=function(){var t,e=this.hostLink,i=this.direct;if(!(this.isHost||!e||e.dead||e.direct||this._rejoin||"open"!==i.state)&&e.remotePj&&!(b()<e.nextDirectAt||e.directTries>=4)){e.directTries++,this._log("trying a direct WebRTC link (attempt "+e.directTries+")");try{t=i.peer.connect(e.remotePj,{label:"hgnet",serialization:"raw",reliable:!0,metadata:{e:this.eid}})}catch(e){t=null}t?this._attachDirect(e,t):e.nextDirectAt=b()+2e4}},ht.prototype._onDirectIncoming=function(t){var e=t&&t.metadata,i=e&&M(e.e,16)?this.links[e.e]:null;if(this.isHost&&i&&i.peer&&"hgnet"===t.label&&(!i.remotePj||i.remotePj===t.peer))i.remotePj=t.peer,this._attachDirect(i,t);else try{t.close()}catch(t){}},ht.prototype._attachDirect=function(t,e){var i=this;t.direct&&t.closeDirect("replaced");var s={conn:e,fast:null,open:!1,up:!1,stalled:!1,lastHeard:0,lastPong:0,lastPing:0,srtt:0,rttvar:0,startedAt:b()};t.direct=s,e.on("open",function(){if(t.direct===s){s.open=!0,s.lastHeard=s.lastPong=b();var n=e.peerConnection;try{var o=n.createDataChannel("hgfast",{negotiated:!0,id:77,ordered:!1,maxRetransmits:0});o.onmessage=function(e){t.direct===s&&i._onDirectData(t,e.data)},s.fast=o}catch(t){}try{n.addEventListener("iceconnectionstatechange",function(){var e=n.iceConnectionState;"failed"!==e&&"closed"!==e||t.direct!==s||t.closeDirect("ICE "+e)})}catch(t){}s.lastPing=b(),t.sendRaw({t:"pi",n:H(b())},v)}}),e.on("data",function(e){t.direct===s&&i._onDirectData(t,e)}),e.on("close",function(){t.direct===s&&t.closeDirect("closed by peer")}),e.on("error",function(){t.direct===s&&t.closeDirect("error")})},ht.prototype._onDirectUnavailable=function(){!this.isHost&&this.hostLink&&this.hostLink.direct&&!this.hostLink.direct.open&&this.hostLink.closeDirect("host unreachable")},ht.prototype._directClosed=function(t,e){this.isHost||this.closed||(e.up&&b()-e.startedAt>6e4&&(t.directTries=Math.min(t.directTries,1)),t.nextDirectAt=b()+[5e3,2e4,6e4][Math.min(Math.max(t.directTries-1,0),2)])},ht.prototype._onRoute=function(t,e){var i=this.isHost?t.peer&&t.peer.pub:this.hostPub;i&&(i.route=e,this._log("route to "+(this.isHost?"#"+i.id:"host")+": "+e),this.isHost||this._status("direct"===e?"Fast direct connection to the host":"Connected through the game server"),this.emit("route",i,e))},ht.prototype._linkHeard=function(t){if(this.isHost){var e=t.peer;if(!e||!e.lagging)return;var i=e.reconnecting;return e.lagging=e.reconnecting=!1,e.pub.lagging=!1,e.pub.state="connected",this._rosterDirty=!0,t.resendAll(),this.emit("lagging",e.pub,!1),void(i&&(this._log("#"+e.id+" is back"),this.emit("reconnected",e.pub,{rejoin:!1})))}t!==this.hostLink||this._rejoin||(this._hostLagging&&(this._hostLagging=!1,this.hostPub.lagging=!1,t.resendAll(),this.emit("lagging",this.hostPub,!1)),this._reconnecting&&(this._reconnecting=!1,this.state="joined",this.hostPub.state="connected",this._status("Reconnected"),this.emit("reconnected",void 0,{rejoin:!1})))},ht.prototype._tickIfLate=function(t){if(!this.closed&&!this._inTick){var e=b()-this._lastTick;(t?e>4e3:e>Math.max(300,3*this.opts.tickMs))&&this._tick()}},ht.prototype._tick=function(){if(!this.closed&&!this._inTick){this._inTick=!0;try{this._tickBody()}finally{this._inTick=!1}}},ht.prototype._tickBody=function(){var t=b(),e=t-this._lastTick,i=this,s=Date.now(),n=s-this._lastWall;if(this._lastTick=t,this._lastWall=s,e>4e3&&t-this._lastRxAt>.8*e){var o=e-this.opts.tickMs;this._log("timers were paused for "+Math.round(e/1e3)+" s - giving peers extra time"),U(this.links,function(e){e.lastHeard=Math.min(t,e.lastHeard+o)}),this.hostLink&&(this.hostLink.lastHeard=Math.min(t,this.hostLink.lastHeard+o)),this.pool&&(this.pool.resetEchoes(),this.pool.checkNow(),this.pool.retryNow())}else n-e>5e3&&this.pool&&(this._log("computer was asleep for about "+Math.round(n/1e3)+" s - checking connections"),this.pool.resetEchoes(),this.pool.checkNow(),this.pool.retryNow());this.pool&&this.pool.lib&&this.pool.tick(t),this.isHost?(U(this.links,function(e){i.closed||e.tick(t)}),this.closed||this._hostTick(t)):(this.hostLink&&!this.closed&&this.hostLink.tick(t),this.closed||this._guestTick(t))},ht.prototype._failBlocked=function(){this._fail("blocked",'Your network is blocking our game servers - try another network (like home Wi-Fi or a phone hotspot), or ask whoever runs this network to allow them. "Test my connection" shows which ones are blocked.')},ht.prototype._fail=function(t,e){var i=this._hostP||this._joinP;this._hostP=this._joinP=null,i?(this._log("failed: "+t),this._byeWhileJoining(),this._shutdown(t,e),i.reject(S(t,e))):this._shutdown(t,e)},ht.prototype._sayBye=function(t,e,i){if(t&&!t.dead&&this.pool){var s={v:1,t:"by",f:this.eid,w:e};i&&(s.x=String(i).slice(0,200));var n=this.isHost?t.peer&&t.peer.key:this._keys&&this._keys.g;n&&(s.k=n);var o=E(s),r=this;this.pool.upList().forEach(function(e){r._relaySend(e,t.out,o)}),t._directSend(o,!1)}},ht.prototype.close=function(){if(!this.closed){var t=this;if(this.isHost&&"hosting"===this.state){U(this.peerRecs,function(e){t._sayBye(e.link,"host-left")});var e=E({v:1,t:"by",f:this.eid,w:"host-left",k:this._roomKey});this.pool.upList().forEach(function(i){t._relaySend(i,t._base()+"b",e)})}else this.isHost||!this.hostLink||"joined"!==this.state&&"reconnecting"!==this.state?this._byeWhileJoining():this._sayBye(this.hostLink,"left");this._shutdown("closed","You left the game.")}},ht.prototype._byeWhileJoining=function(){if(!this.isHost&&"joining"===this.state&&this.pool){var t=this,e=E({v:1,t:"by",f:this.eid,w:"left"});this.pool.upList().forEach(function(i){t._relaySend(i,t._base()+"h",e)})}},ht.prototype._shutdown=function(e,i){if(!this.closed){var s=this.state;this.closed=!0,this.state="closed",this._stopTick&&(this._stopTick(),this._stopTick=null),t.removeEventListener&&(t.removeEventListener("pagehide",this._onPageHide),t.removeEventListener("online",this._onOnline)),t.document&&t.document.removeEventListener&&t.document.removeEventListener("visibilitychange",this._onVisible),U(this.links,function(t){t.destroy()}),this.hostLink&&this.hostLink.destroy(),this.direct.close(),this.pool&&this.pool.close(),this.isHost||!this.code||"host-left"!==e&&"kicked"!==e||function(e,i){try{t.sessionStorage.removeItem(Z(e,i))}catch(t){}}(this.game,this.code);var n=this._hostP||this._joinP;this._hostP=this._joinP=null,n&&n.reject(S(e,i)),this._log("closed: "+e),this._status(i),"hosting"!==s&&"joined"!==s&&"reconnecting"!==s||this.emit("closed",e,i)}},ht.prototype.send=function(t,e,i){if(this.closed||"hosting"!==this.state&&"joined"!==this.state&&"reconnecting"!==this.state)return!1;var s=!(!i||!i.fast),n=q(e);if(this.isHost){var o=i&&i.except;return this._hostDeliver(t,n,s,void 0,void 0===o?void 0:P(o)?o:[o])}if(!this.hostLink||this.hostLink.dead)return!1;var r={};if("all"===t||"*"===t)r.to="*";else if("host"!==t&&0!==I(t)){var a=I(t);if(null===a||a===this.id)return!1;r.to=a}return this.hostLink.sendData(n,s,r)},ht.prototype.forward=function(t,e,i,s){if(!this.isHost||"hosting"!==this.state)return!1;var n=I(t),o=!(!s||!s.fast),r=[];return null!==n&&0!==n&&r.push(n),s&&void 0!==s.except&&(r=r.concat(P(s.except)?s.except:[s.except])),this._hostDeliver(e,q(i),o,null===n?void 0:n,r)},ht.prototype._hostDeliver=function(t,e,i,s,n){var o=this,a=[],h="all"===t||"*"===t,l={};if((n||[]).forEach(function(t){var e=I(t);null!==e&&(l[e]=!0)}),h?U(this.peerRecs,function(t){l[t.id]||a.push(t)}):(P(t)?t:[t]).forEach(function(t){var e=I(t);null!==e&&o.peerRecs[e]&&!l[e]&&a.push(o.peerRecs[e])}),!a.length)return!1;var c=s?{fr:s}:{};return i&&h&&a.length>1&&e.length+300<=r.payload?(this._broadcastFast(a,e,c,n),!0):(a.forEach(function(t){t.link.sendData(e,i,c)}),!0)},ht.prototype._broadcastFast=function(t,e,i,s){var n,o=++this.fastSeq,r={},a=b(),h=this;t.forEach(function(t){var s=t.link.pickRoute(0,a);s===_?t.link.sendData(e,!0,i,o):s&&!h.opts.noRelay&&(r[s.idx]=s)});var l={v:1,t:"u",f:this.eid,q:o};for(n in i)l[n]=i[n];var c=(s||[]).map(I).filter(function(t){return null!==t});c.length&&(l.x=c);var u=E(l,e),d=this._base()+"b";U(r,function(t){h._impair(function(){h._relaySend(t,d,u,!0)})})},ht.prototype.kick=function(t,e){if(!this.isHost)return!1;var i=this.peerRecs[I(t)];return!!i&&(this._sayBye(i.link,"kicked",e),this._removePeer(i,"kicked",!1),!0)},ht.prototype.peers=function(){var t=[];function e(t){return{id:t.id,name:t.name,info:t.info,isHost:t.isHost,route:t.route,rtt:t.rtt,lagging:t.lagging,state:t.state}}return this.isHost||!this.hostPub||this.closed||t.push(e(this.hostPub)),U(this.peerRecs,function(i){t.push(e(i.pub))}),t},ht.prototype.backlog=function(t){if(!this.isHost)return this.hostLink?this.hostLink.backlog():0;var e=this.peerRecs[I(t)];return e?e.link.backlog():0},ht.prototype.getStats=function(){var t,e={};for(t in this.stats)e[t]=this.stats[t];return e.state=this.state,e.code=this.code,e.id=this.id,e.isHost=this.isHost,e.relays=this.pool?this.pool.info():[],e.webrtc=this.direct.state,e},ht.prototype.logs=function(){return this._logs.slice()};var k={version:e,create:function(t){return new ht(t)},diagnose:ct,renderDiagnostics:function(e,i,s){if("string"==typeof e&&(e=t.document.querySelector(e)),!e)return Promise.reject(new Error("HGNet.renderDiagnostics: element not found"));if(i&&i.relays)return dt(e,i),Promise.resolve(i);var n,o=(s=s||{}).onProgress,r={};for(n in s)r[n]=s[n];return r.onProgress=function(t){dt(e,t),"function"==typeof o&&o(t)},dt(e,{relays:X(s).relays.map(function(t){return{name:t.name,url:t.url,ok:null}})}),ct(r)},every:function(t,e){if("function"!=typeof e)throw new Error("HGNet.every(ms, fn): fn must be a function");return Y(t,e)},isValidCode:function(t){return/^\d{6}$/.test(C(t))},defaults:{relays:s,iceServers:n,timings:a,limits:r,libs:o}};t.HGNet=k}function b(){return h?h.now():Date.now()}function w(){}function x(t){return"number"==typeof t&&isFinite(t)}function j(t,e,i){return"number"==typeof t&&t%1==0&&t>=e&&t<=i}function M(t,e){return"string"==typeof t&&t.length<=e}function P(t){return"[object Array]"===Object.prototype.toString.call(t)}function R(t){return null!==t&&"object"==typeof t&&!P(t)}function T(t,e,i,s){return t=Number(t),isFinite(t)?Math.min(i,Math.max(e,t)):s}function H(t){return Math.round(10*t)/10}function L(){try{return!(!t.document||!t.document.hidden)}catch(t){return!1}}function A(e){try{var i=t.crypto||t.msCrypto;if(i&&i.getRandomValues){var s=new Uint32Array(1);return i.getRandomValues(s),s[0]%e}}catch(t){}return Math.floor(Math.random()*e)}function D(t){for(var e="";e.length<t;)e+="abcdefghijklmnopqrstuvwxyz0123456789".charAt(A(36));return e}function C(t){return String(null==t?"":t).replace(/[\s.\-]/g,"")}function S(t,e){var i=new Error(e);return i.code=t,i}function N(t){return/[^\x00-\x7e]/.test(t)?t.replace(/[\u007f-\uffff]/g,function(t){return"\\u"+("000"+t.charCodeAt(0).toString(16)).slice(-4)}):t}function q(t){var e=JSON.stringify(void 0===t?null:t);if(void 0===e&&(e="null"),(e=N(e)).length>r.message)throw S("too-big","HGNet: message is too big ("+e.length+" bytes, max "+r.message+").");return e}function E(t,e){var i=N(JSON.stringify(t));return void 0!==e&&(i=i.slice(0,-1)+',"m":'+e+"}"),i}function F(t){try{var e=JSON.stringify(t);return void 0===e?0:N(e).length}catch(t){return 1/0}}function O(t,e){return(t=("string"==typeof t?t:null==t?"":String(t)).replace(/[\u0000-\u001f\u007f\u2028\u2029]/g,"").replace(/^\s+|\s+$/g,"")).slice(0,r.name)||e}function I(t){return"string"==typeof t&&/^\d{1,3}$/.test(t)&&(t=+t),j(t,0,r.maxId)?t:null}function B(e){if("string"==typeof e)return e;try{if(t.TextDecoder)return(new t.TextDecoder).decode(e)}catch(t){}return String(e)}function U(t,e){for(var i in t)Object.prototype.hasOwnProperty.call(t,i)&&e(t[i],i)}function W(){}function G(e,i,s,n){if(t[i])return Promise.resolve(t[i]);if(l[e])return l[e];var o=new Promise(function(o,r){var a=0;!function h(){if(t[i])o(t[i]);else if(!t.document||a>=s.length)r(S("blocked","Could not load "+e));else{var l=s[a++],c=t.document.createElement("script"),u=!1,d=setTimeout(function(){p(!1)},n||15e3);c.onload=function(){p(!0)},c.onerror=function(){p(!1)},c.async=!0,c.src=l,(t.document.head||t.document.documentElement).appendChild(c)}function p(e){u||(u=!0,clearTimeout(d),c.onload=c.onerror=null,e&&t[i]?o(t[i]):h())}}()});return l[e]=o,o.then(null,function(){l[e]===o&&delete l[e]}),o}function z(t){return G("mqtt","mqtt",t.libs.mqtt,15e3)}function $(t){return G("peerjs","Peer",t.libs.peerjs,15e3)}function V(){if(null!==c)return c;try{var e=t.URL.createObjectURL(new t.Blob([""],{type:"application/javascript"}));new t.Worker(e).terminate(),t.URL.revokeObjectURL(e),c=!0}catch(t){c=!1}return c}function J(){var e=u;u=[];for(var i=0;i<e.length;i++)try{e[i]()}catch(e){t.console&&t.console.error("[HGNet]",e)}}function K(e){if(u.push(e),!(u.length>1)){if(null===d)try{(d=new t.MessageChannel).port1.onmessage=J}catch(t){d=!1}d?d.port2.postMessage(0):setTimeout(J,0)}}function Y(e,i){e=Math.max(4,Math.round(T(e,4,36e5,100)));var s=p.next++,n=b(),o=!1,r=function(){if(void 0!==p.w)return p.w;if(p.w=null,!V())return null;try{var e=t.URL.createObjectURL(new t.Blob(["var t={};onmessage=function(e){var d=e.data;clearInterval(t[d[1]]);delete t[d[1]];if(d[0])t[d[1]]=setInterval(function(){postMessage(d[1])},d[2])}"],{type:"application/javascript"})),i=new t.Worker(e);i.onmessage=function(t){var e=p.fns[t.data];e&&e()},i.onerror=function(){p.w=null},p.w=i}catch(t){p.w=null}return p.w}();function a(){if(!o){var t=b();if(!(t-n<.75*e)){var s=t-n;n=t,i(s)}}}var h=setInterval(a,e);if(r){p.fns[s]=a;try{r.postMessage([1,s,e])}catch(t){delete p.fns[s]}}return function(){if(!o&&(o=!0,clearInterval(h),p.fns[s])){delete p.fns[s];try{p.w&&p.w.postMessage([0,s])}catch(t){}}}}function Q(){var e={},i="",s={};try{i=t.location&&t.location.search||""}catch(t){return e}return i.replace(/^\?/,"").split("&").forEach(function(t){if(t){var e=t.indexOf("=");try{s[decodeURIComponent(e<0?t:t.slice(0,e)).toLowerCase()]=e<0?"":decodeURIComponent(t.slice(e+1).replace(/\+/g," "))}catch(t){}}}),s.hgrelays&&(e.relays=s.hgrelays.split(",")),"hgpeer"in s&&(e.peer="off"!==s.hgpeer&&"0"!==s.hgpeer&&function(t){var e=/^(?:(https?|wss?):\/\/)?([^:\/?#]+)(?::(\d+))?(\/[^?#]*)?$/.exec(String(t||"").replace(/^\s+|\s+$/g,""));if(!e)return null;var i=e[3]?+e[3]:e[1]?/s$/.test(e[1])?443:80:443;return{host:e[2],port:i,path:e[4]||"/",secure:e[1]?/s$/.test(e[1]):443===i}}(s.hgpeer)),"hgforcerelay"in s&&(e.forceRelay="0"!==s.hgforcerelay),"hgnorelay"in s&&(e.noRelay="0"!==s.hgnorelay),s.hgdrop&&(e.dropRate=parseFloat(s.hgdrop)),s.hglatency&&(e.latency=parseFloat(s.hglatency)),s.hgjitter&&(e.jitter=parseFloat(s.hgjitter)),"hglog"in s&&(e.log="0"!==s.hglog),"none"===s.hgice&&(e.iceServers=[]),e}function X(t){var e,i,r=!1===(t=t||{}).urlParams?{}:Q(),h={};function l(e){return void 0!==r[e]?r[e]:t[e]}h.game=(i=t.game,(i=String(i||"game").toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,24))||"game"),h.relays=function(t){var e=[],i={};return(P(t)?t:[t]).forEach(function(t){if("string"==typeof t&&(t={url:t}),R(t)&&"string"==typeof t.url){var s=t.url.replace(/^\s+|\s+$/g,"");if(!(!/^wss?:\/\/[^\s\/]+/i.test(s)||i[s]||e.length>=8)){i[s]=!0;var n=/^wss?:\/\/([^\/:]+)/i.exec(s)[1];e.push({url:s,name:t.name?String(t.name).slice(0,24):n,username:t.username,password:t.password})}}}),e}(l("relays")||s);var c=l("peer");for(e in h.peer=!1!==c&&(R(c)?c:{}),h.iceServers=P(l("iceServers"))?l("iceServers"):n,h.forceRelay=!!l("forceRelay"),h.noRelay=!!l("noRelay"),h.dropRate=T(l("dropRate"),0,1,0),h.latency=T(l("latency"),0,2e4,0),h.jitter=T(l("jitter"),0,2e4,0),h.log=l("log"),h.guestToGuest=!1!==t.guestToGuest,h.resume=!1!==t.resume,h.libs={mqtt:P(t.mqttUrls)?t.mqttUrls:o.mqtt,peerjs:P(t.peerjsUrls)?t.peerjsUrls:o.peerjs},a)h[e]=x(t[e])&&t[e]>0?t[e]:a[e];return h}function Z(t,e){return"hgnet:"+t+":"+e}function tt(t){if("string"!=typeof t||t.length>r.incoming||123!==t.charCodeAt(0))return null;var e;try{e=JSON.parse(t)}catch(t){return null}return R(e)&&1===e.v&&M(e.t,2)&&M(e.f,16)&&f.test(e.f)?e:null}function et(t){this.net=t,this.list=t.opts.relays.map(function(t,e){return{idx:e,url:t.url,name:t.name,username:t.username,password:t.password,client:null,up:!1,everUp:!1,upAt:0,failures:0,attempts:0,hung:0,retryAt:0,connectStart:0,connectMs:null,lastPingReq:0,rtt:null,lastError:"",lastRx:0,echoOut:null,echoMiss:0,suspect:!1,txBytes:0,rxBytes:0}}),this.topics=[],this.will=null,this.lib=null,this.closed=!1,this.lastUpAt=0}function it(t){var e=t&&!t.placeholder&&t.stream&&t.stream.socket;return e&&1===e.readyState&&"function"==typeof e.send?e:null}function st(t,e,i){this.net=t,this.eid=e,this.out=i,this.peer=null,this.dead=!1,this.lastHeard=b(),this.goneAt=0,this.txSeq=0,this.unacked={},this.unackedN=0,this.queue=[],this.dsrtt=0,this.drttvar=0,this.rxNext=1,this.rxBuf={},this.rxBufN=0,this.rxChunk=null,this.ackPending=!1,this.ackTimer=null,this.fastMax={},this.fastParts={},this.rs={},this.primary=null,this.direct=null,this.lastPong=0,this.route="relay",this.remotePj=null,this.directTries=0,this.nextDirectAt=0}function nt(t,e){var i=t.rs[e.idx];return(i&&i.srtt?i.srtt:400)+(i?1500*i.loss:0)+15*e.idx}function ot(t){return P(t.c)&&2===t.c.length&&j(t.c[1],2,r.chunks)&&j(t.c[0],0,t.c[1]-1)&&"string"==typeof t.p}function rt(t){return void 0===t.fr?0:I(t.fr)}function at(t){this.net=t,this.peer=null,this.id=null,this.state="idle",this.fails=0,this.retry=null}function ht(t){this._ev={},this.opts=X(t),this.game=this.opts.game,this.eid=D(12),this.id=null,this.isHost=!1,this.code=null,this.state="idle",this.closed=!1,this.hostInfo=null,this.pool=null,this.direct=new at(this),this.links={},this.peerRecs={},this.fastSeq=0,this.stats={txFrames:0,rxFrames:0,txRelay:0,rxRelay:0,txDirect:0,rxDirect:0,retransmits:0,malformed:0,impairDropped:0},this._logs=[],this._stopTick=null,this._lastTick=b(),this._lastWall=Date.now(),this._lastRxAt=0;var e=this;this._onPageHide=function(){e.close()},this._onOnline=function(){e.pool&&!e.closed&&(e.pool.retryNow(),e.pool.checkNow())},this._onVisible=function(){L()||!e.pool||e.closed||(e.pool.retryNow(),e.pool.checkNow(),e._tick())},this.opts.noRelay&&this.opts.forceRelay&&this._log("warning: noRelay + forceRelay means game data has no route at all")}function lt(t,e,i,s){return{id:t,name:e,info:void 0===i?null:i,isHost:!!s,route:"relay",rtt:null,lagging:!1,state:"connected"}}function ct(s){var n=X(s=s||{}),o=x(s.timeoutMs)?s.timeoutMs:8e3,r="function"==typeof s.onProgress?s.onProgress:w,a={when:(new Date).toISOString(),version:e,relays:n.relays.map(function(t){return{name:t.name,url:t.url,ok:null,connectMs:null,rttMs:null,error:""}}),peerServer:null,webrtc:null,summary:null};function h(){try{r(a)}catch(t){}}var l=z(n).then(function(t){return Promise.all(n.relays.map(function(e,s){return function(t,e,s){return new Promise(function(n){var o,r=b(),a={name:e.name,url:e.url,ok:!1,connectMs:null,rttMs:null,error:""},h=!1,l="",c=0,u=i+"/diag/"+D(12);function d(t,e){if(!h){h=!0,clearTimeout(p),a.ok=t,t||(a.error=e||l||"blocked");try{o&&o.end(!0)}catch(t){}n(a)}}var p=setTimeout(function(){d(!1,null===a.connectMs?"no answer (blocked?)":"connected but messages do not come back")},s),f={clientId:"hgd"+D(12),clean:!0,protocolVersion:4,connectTimeout:s,reconnectPeriod:0,keepalive:30,timerVariant:V()?"auto":"native"};e.username&&(f.username=e.username,f.password=e.password||"");try{o=t.connect(e.url,f)}catch(t){return void d(!1,"bad address")}o.on("connect",function(){a.connectMs=Math.round(b()-r),o.subscribe(u,{qos:0},function(t){t?d(!1,"subscribe refused"):(c=b(),o.publish(u,"hgnet-diag",{qos:0}))})}),o.on("message",function(t){t===u&&c&&(a.rttMs=Math.round(b()-c),d(!0))}),o.on("error",function(t){l=String(t&&t.message||t).slice(0,60)}),o.on("close",function(){d(!1)})})}(t,e,o).then(function(t){a.relays[s]=t,h()})}))},function(){a.relays.forEach(function(t){t.ok=!1,t.error="could not load the game-server code (cdn.jsdelivr.net blocked?)"}),h()}),c=function(t,e){var i=t.peer||{},s=i.host||"0.peerjs.com",n={name:"WebRTC signalling ("+s+")",host:s,ok:!1,ms:null,error:""};return!1===t.peer?(n.error="turned off",Promise.resolve(n)):$(t).then(function(t){return new Promise(function(s){var o,r=b(),a=!1;function h(t,e){if(!a){a=!0,clearTimeout(l),n.ok=t,t?n.ms=Math.round(b()-r):n.error=e;try{o&&o.destroy()}catch(t){}s(n)}}var l=setTimeout(function(){h(!1,"no answer (blocked?)")},e),c={debug:0,config:{iceServers:[]}};i.host&&(c.host=i.host),i.port&&(c.port=i.port),i.path&&(c.path=i.path),void 0!==i.secure&&(c.secure=!!i.secure),i.key&&(c.key=i.key);try{o=new t("hgn-diag-"+D(12),c)}catch(t){return void h(!1,"error")}o.on("open",function(){h(!0)}),o.on("error",function(t){h(!1,t&&t.type||"error")})})},function(){return n.error="library blocked",n})}(n,o).then(function(t){a.peerServer=t,h()}),u=function(e,i){var s={name:"Direct connection (WebRTC)",ok:!1,host:0,srflx:0,relay:0,ms:null,error:""};return"function"!=typeof t.RTCPeerConnection?(s.error="not supported",Promise.resolve(s)):new Promise(function(n){var o,r=b(),a=!1;function h(){if(!a){a=!0,clearTimeout(l);try{o.close()}catch(t){}s.ms=Math.round(b()-r),s.ok=s.srflx+s.relay>0,s.ok||s.error||(s.error=s.host?"only local network":"blocked"),n(s)}}var l=setTimeout(h,i);try{(o=new t.RTCPeerConnection({iceServers:e.iceServers})).createDataChannel("diag"),o.onicecandidate=function(t){if(t.candidate){var e=/ typ (host|srflx|prflx|relay)/.exec(t.candidate.candidate||"");e&&("host"===e[1]?s.host++:"relay"===e[1]?s.relay++:s.srflx++)}else h()},o.createOffer().then(function(t){return o.setLocalDescription(t)}).then(null,function(){s.error="error",h()})}catch(t){s.error="error",h()}})}(n,Math.min(o,6e3)).then(function(t){a.webrtc=t,h()});return Promise.all([l,c,u]).then(function(){return a.summary=function(t){var e=t.relays.filter(function(t){return t.ok}),i=t.relays.length;if(!e.length)return{level:"bad",canPlay:!1,text:"Online games cannot connect from this network: all "+i+" game servers are blocked.",advice:"Try a different network (home Wi-Fi or a phone hotspot). On a school or work network, ask IT to allow secure WebSocket (wss://) connections to: "+t.relays.map(function(t){return t.url.replace(/^wss?:\/\//,"").replace(/\/.*$/,"")}).join(", ")+"."};e.sort(function(t,e){return(t.rttMs||9999)-(e.rttMs||9999)});var s="Online play should work: "+e.length+" of "+i+" game servers reachable (fastest: "+e[0].name+", "+e[0].rttMs+" ms).",n=t.webrtc&&t.webrtc.ok?"Direct connections are possible too, so games can get even faster.":"Direct connections look blocked - that is fine, games run through the game servers with a little extra delay.";return 1===e.length&&(n+=" Only one server works here; if games still drop, try another network."),e[0].rttMs>400&&(n+=" The connection is slow right now (high ms), so expect some lag."),{level:e.length>1?"good":"ok",canPlay:!0,text:s,advice:n}}(a),h(),a})}function ut(t){return String(null==t?"":t).replace(/[&<>"']/g,function(t){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[t]})}function dt(t,i){var s=function(t,e,i,s,n){return'<tr><td style="padding:5px 8px 5px 0;vertical-align:top">'+ut(t)+'<div style="font-size:11px;opacity:.65;word-break:break-all">'+ut(e)+'</div></td><td style="padding:5px 8px;white-space:nowrap;vertical-align:top">'+function(t,e){return'<span style="display:inline-block;min-width:64px;text-align:center;padding:2px 8px;border-radius:10px;background:'+(null===t?"#5b6472":t?"#1f9d55":"Limited"===e?"#b7791f":"#c0392b")+';color:#fff;font-weight:600;font-size:12px">'+ut(e)+"</span>"}(i,s)+'</td><td style="padding:5px 0;text-align:right;white-space:nowrap;vertical-align:top;font-variant-numeric:tabular-nums">'+ut(n)+"</td></tr>"},n='<div style="font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:10px;padding:12px 14px;max-width:560px;box-sizing:border-box">';if(n+='<div style="font-weight:700;font-size:15px;margin-bottom:4px">Connection test</div>',i.summary){var o="bad"===i.summary.level?"#ff7b72":"ok"===i.summary.level?"#e3b341":"#56d364";n+='<div style="color:'+o+';font-weight:600;margin-bottom:2px">'+ut(i.summary.text)+'</div><div style="margin-bottom:8px;opacity:.9">'+ut(i.summary.advice)+"</div>"}else n+='<div style="opacity:.8;margin-bottom:8px">Testing your connection - this takes up to 10 seconds...</div>';n+='<table style="width:100%;border-collapse:collapse"><tr style="font-size:12px;opacity:.6;text-align:left"><th style="font-weight:500;padding-bottom:4px">Route</th><th style="font-weight:500">Result</th><th style="font-weight:500;text-align:right">Time</th></tr>',i.relays.forEach(function(t){n+=s("Game server "+t.name,t.url+(t.error&&!1===t.ok?" - "+t.error:""),t.ok,null===t.ok?"testing":t.ok?"OK":"Blocked",t.ok?t.rttMs+" ms":"")});var r=i.peerServer,a=i.webrtc;n+=r?s(r.name,r.ok?"needed for direct connections":r.error,r.ok,r.ok?"OK":"Blocked",r.ok?r.ms+" ms":""):s("WebRTC signalling","",null,"testing",""),n+=a?s(a.name,a.ok?a.relay?"public address + TURN relay found":"public address found":"only local network"===a.error?"only works on the same Wi-Fi":a.error,a.ok,a.ok?"OK":"Limited",a.ok?a.ms+" ms":""):s("Direct connection (WebRTC)","",null,"testing",""),n+='</table><div style="font-size:11px;opacity:.5;margin-top:6px">HGNet '+e+(i.when?" - "+ut(i.when.replace("T"," ").slice(0,19)):"")+"</div></div>",t.innerHTML=n}}("undefined"!=typeof window?window:this);
(function(){
// ---- Ed25519, in ~120 lines ------------------------------------------------
// RFC 8032, plain BigInt arithmetic, SHA-512 from WebCrypto. No library, no
// browser flag, deterministic from a 32-byte seed — which is exactly what the
// recovery key already is once hashed. Checked against Node's native Ed25519
// on RFC test vectors in test/ed25519.mjs. Everything is async because the
// hash is; nothing here is on a hot path (a signature per message, at most).
const ED = (() => {
  const P = (1n << 255n) - 19n;
  const L = (1n << 252n) + 27742317777372353535851937790883648493n;
  const mod = (a, m = P) => { const r = a % m; return r >= 0n ? r : r + m; };
  const pow = (b, e, m = P) => { let r = 1n; b = mod(b, m); while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
  const inv = a => pow(a, P - 2n);
  const D = mod(-121665n * inv(121666n));
  const SQRT_M1 = pow(2n, (P - 1n) / 4n);
  const G = { x: 15112221349535400772501151409588531511454012693041857206046113283949847762202n,
              y: 46316835694926478169428394003475163141307993866256225615783033603165251855960n };
  // extended coordinates (X, Y, Z, T), a = -1
  const ext = p => ({ X: p.x, Y: p.y, Z: 1n, T: mod(p.x * p.y) });
  const ZERO = { X: 0n, Y: 1n, Z: 1n, T: 0n };
  const add = (p, q) => {
    const A = mod((p.Y - p.X) * (q.Y - q.X)), B = mod((p.Y + p.X) * (q.Y + q.X));
    const C = mod(p.T * 2n * D * q.T), Dd = mod(p.Z * 2n * q.Z);
    const E = B - A, F = Dd - C, Gg = Dd + C, H = B + A;
    return { X: mod(E * F), Y: mod(Gg * H), Z: mod(F * Gg), T: mod(E * H) };
  };
  const dbl = p => {
    const A = mod(p.X * p.X), B = mod(p.Y * p.Y), C = mod(2n * p.Z * p.Z);
    const H = A + B, E = H - mod((p.X + p.Y) * (p.X + p.Y)), Gg = A - B, F = C + Gg;
    return { X: mod(E * F), Y: mod(Gg * H), Z: mod(F * Gg), T: mod(E * H) };
  };
  const mul = (p, n) => { let r = ZERO, b = p; while (n > 0n) { if (n & 1n) r = add(r, b); b = dbl(b); n >>= 1n; } return r; };
  const affine = p => { const zi = inv(p.Z); return { x: mod(p.X * zi), y: mod(p.Y * zi) }; };
  const b2n = b => { let n = 0n; for (let i = b.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(b[i]); return n; };   // little-endian
  const n2b = (n, len = 32) => { const b = new Uint8Array(len); for (let i = 0; i < len; i++) { b[i] = Number(n & 255n); n >>= 8n; } return b; };
  const encode = p => { const a = affine(p); const b = n2b(a.y); b[31] |= Number(a.x & 1n) << 7; return b; };
  const decode = b => {
    if (b.length !== 32) return null;
    const sign = b[31] >> 7; const yb = b.slice(); yb[31] &= 127; const y = b2n(yb);
    if (y >= P) return null;
    const y2 = mod(y * y), u = mod(y2 - 1n), v = mod(D * y2 + 1n);
    let x = mod(pow(u * inv(v), (P + 3n) / 8n));
    if (mod(x * x - u * inv(v)) !== 0n) x = mod(x * SQRT_M1);
    if (mod(x * x - u * inv(v)) !== 0n) return null;
    if (x === 0n && sign) return null;
    if (Number(x & 1n) !== sign) x = P - x;
    return ext({ x, y });
  };
  const cat = (...arrs) => { const n = arrs.reduce((a, c) => a + c.length, 0); const o = new Uint8Array(n); let i = 0; for (const a of arrs) { o.set(a, i); i += a.length; } return o; };
  const sha512 = async b => new Uint8Array(await crypto.subtle.digest('SHA-512', b));
  const clamp = h => { const a = h.slice(0, 32); a[0] &= 248; a[31] &= 127; a[31] |= 64; return b2n(a); };
  const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  const unhex = h => { if (typeof h !== 'string' || h.length % 2 || /[^0-9a-f]/i.test(h)) return null; const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
  const bytes = s => typeof s === 'string' ? new TextEncoder().encode(s) : s;

  async function keypair(seed){                         // seed: 32 bytes
    const h = await sha512(seed);
    const a = clamp(h);
    return { seed, a, prefix: h.slice(32), pub: encode(mul(ext(G), a)) };
  }
  async function sign(kp, msg){
    const M = bytes(msg);
    const r = mod(b2n(await sha512(cat(kp.prefix, M))), L);
    const R = encode(mul(ext(G), r));
    const k = mod(b2n(await sha512(cat(R, kp.pub, M))), L);
    return cat(R, n2b(mod(r + k * kp.a, L)));
  }
  async function verify(pub, msg, sig){
    try {
      pub = typeof pub === 'string' ? unhex(pub) : pub; sig = typeof sig === 'string' ? unhex(sig) : sig;
      if (!pub || !sig || sig.length !== 64) return false;
      const A = decode(pub), R = decode(sig.slice(0, 32)); if (!A || !R) return false;
      const s = b2n(sig.slice(32)); if (s >= L) return false;
      const k = mod(b2n(await sha512(cat(sig.slice(0, 32), pub, bytes(msg)))), L);
      const lhs = encode(mul(ext(G), s)), rhs = encode(add(R, mul(A, k)));
      return hex(lhs) === hex(rhs);
    } catch (e) { return false; }
  }
  return { keypair, sign, verify, hex, unhex, bytes };
})();
// GVLink — reach the Grapevine server over public MQTT relays instead of WebRTC.
// Shared by client.html and the launcher's Grapevine Lite. Needs HGNet (relay/hgnet.js)
// and an Ed25519 verifier. The server half is relay/server.js; read its header for the
// wire format. Returns an object shaped like a PeerJS DataConnection (peer, open, send,
// close, on('open'|'data'|'close'|'error')) so the code above it does not care which
// transport it is on.
const GVLink = (() => {
  'use strict';
  const MQTT = {
    // Byte-for-byte the mqtt@5.10.1 build the server runs. The browser refuses it if it differs.
    urls: ['https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js', 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js'],
    sri: 'sha384-u4uqeACkFcoKl57rBQJHVGDd1pqhW4w8X3WjTu1ZksPdxoLqdt34jpoNkJisE25W'
  };
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = u8 => Array.from(u8, b => b.toString(16).padStart(2, '0')).join('');
  const sha256hex = async s => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s))));
  const nonce = (dir, n) => { const b = new Uint8Array(12); b[0] = dir; new DataView(b.buffer).setBigUint64(4, BigInt(n)); return b; };

  // Same derivation as relay/server.js: nothing to configure on either side.
  async function address(archiveId, shard) {
    const game = 'gv-' + (await sha256hex('gv-relay|' + archiveId)).slice(0, 10);
    const code = String(100000 + (parseInt((await sha256hex(`gv-relay|${archiveId}|${shard}`)).slice(0, 8), 16) % 900000));
    return { game, code };
  }

  let mqttP = null;
  function loadMqtt() {
    if (window.mqtt) return Promise.resolve();
    if (mqttP) return mqttP;
    mqttP = new Promise((resolve, reject) => {
      let i = 0;
      (function next() {
        if (window.mqtt) return resolve();
        if (i >= MQTT.urls.length) { mqttP = null; return reject(new Error('could not load the relay library')); }
        const s = document.createElement('script');
        s.src = MQTT.urls[i++]; s.integrity = MQTT.sri; s.crossOrigin = 'anonymous';
        const t = setTimeout(() => { s.onload = s.onerror = null; next(); }, 12000);
        s.onload = () => { clearTimeout(t); next(); };
        s.onerror = () => { clearTimeout(t); next(); };
        document.head.appendChild(s);
      })();
    });
    return mqttP;
  }

  function emitter(o) {
    const h = {};
    o.on = (ev, fn) => ((h[ev] = h[ev] || []).push(fn), o);
    o.off = (ev, fn) => { h[ev] = (h[ev] || []).filter(f => f !== fn); return o; };
    o.emit = (ev, ...a) => { for (const f of (h[ev] || []).slice()) { try { f(...a); } catch (e) { console.error(e); } } };
    return o;
  }
  const shuffled = n => { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // opts: { shards (2), pinned (hex server key or ''), verify(pubHex, msg, sigHex) -> Promise<bool>,
  //         relays (override), urlParams (false), onStatus(text) }
  function connect(archiveId, opts) {
    opts = opts || {};
    const conn = emitter({ peer: archiveId, open: false, relay: true, pid: '', serverPub: '', metadata: { role: 'client' }, status: '' });
    const early = [];
    let net = null, key = null, tx = 0, rx = 0, dead = false, sendQ = Promise.resolve(), rxQ = Promise.resolve();
    const say = t => { conn.status = t; try { opts.onStatus && opts.onStatus(t); } catch (e) {} conn.emit('status', t); };
    const finish = (why, errType) => {
      if (dead) return; dead = true;
      conn.open = false;
      try { net && net.close(); } catch (e) {}
      if (errType) conn.emit('error', { type: errType, message: why });
      conn.emit('close', why);
    };
    conn.close = () => finish('closed');
    conn.send = obj => {
      if (!conn.open || dead) throw new Error('link closed');
      const n = ++tx, text = JSON.stringify(obj);
      sendQ = sendQ.then(async () => {
        if (dead) return;
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce(0, n) }, key, te.encode(text)));
        net.send('host', { k: 'd', n, c: b64(ct) });
      }).catch(e => { console.warn('relay send:', e && e.message); });
    };

    (async () => {
      say('loading relay library…');
      await loadMqtt();
      if (!window.HGNet) throw new Error('relay code missing');
      const nshards = Math.max(1, Math.min(Number(opts.shards) || 2, 8));
      let joined = null, lastErr = null;
      for (const i of shuffled(nshards)) {
        if (dead) return;
        const { game, code } = await address(archiveId, i);
        const n = window.HGNet.create({ game, forceRelay: true, peer: false, resume: false,
          urlParams: opts.urlParams === true, relays: opts.relays || undefined });
        n.on('status', t => say(t));
        try { await n.join(code, { name: 'gv' }); joined = n; break; }
        catch (e) { lastErr = e; try { n.close(); } catch (x) {} if (e && (e.code === 'blocked' || e.code === 'closed')) break; }
      }
      if (dead) { try { joined && joined.close(); } catch (e) {} return; }
      if (!joined) {
        const e = lastErr || new Error('no server');
        return finish(e.code === 'blocked' ? 'blocked' : 'no-server', e.code === 'blocked' ? 'blocked' : 'peer-unavailable');
      }
      net = joined;
      net.on('closed', (reason) => finish(reason || 'closed'));

      // ---- key exchange ----
      say('securing the link…');
      const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
      const cpub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
      const cpubB64 = b64(cpub);
      const reply = new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('server did not answer')), 12000);
        net.on('message', (peer, m) => {
          if (!m || typeof m !== 'object') return;
          if (m.k === 'ke' && !key) { clearTimeout(t); resolve(m); }
          else if (m.k === 'nk') finish('reset');
          else if (m.k === 'd') { if (key) onData(m); else early.push(m); }   // the challenge can beat our key derivation
        });
      });
      net.send('host', { k: 'ke', v: 1, pub: cpubB64 });
      const m = await reply;
      const spubB64 = String(m.pub || ''), pid = String(m.pid || ''), spub = String(m.spub || '');
      if (!/^rl-[0-9a-f]{12}$/.test(pid) || !/^[0-9a-f]{64}$/.test(spub)) throw new Error('bad key exchange');
      if (opts.pinned && opts.pinned !== spub) return finish('not-pinned', 'link-key');
      if (!(await opts.verify(spub, `gv-link|${cpubB64}|${spubB64}|${pid}`, String(m.sig || '')))) return finish('bad-signature', 'link-key');
      const spubKey = await crypto.subtle.importKey('raw', unb64(spubB64), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
      const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: spubKey }, kp.privateKey, 256);
      const hk = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
      key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: te.encode(`gv-link|${cpubB64}|${spubB64}|${pid}`) },
        hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      conn.pid = pid; conn.serverPub = spub;
      conn.open = true;
      say('connected through relay');
      early.splice(0).forEach(onData);
      conn.emit('open');
    })().catch(e => finish(String(e && e.message || e), 'network'));

    function onData(m) {
      if (!Number.isSafeInteger(m.n) || typeof m.c !== 'string') return;
      rxQ = rxQ.then(async () => {
        if (dead || m.n <= rx) return;
        let obj;
        try { obj = JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce(1, m.n) }, key, unb64(m.c)))); }
        catch (e) { return; }       // forged or damaged: ignored
        rx = m.n;
        conn.emit('data', obj);
      });
    }
    return conn;
  }

  // For /diag: which relays can this network reach?
  async function diagnose(opts) {
    await loadMqtt();
    return window.HGNet.diagnose(Object.assign({ game: 'gv-diag', urlParams: false }, opts || {}));
  }

  return { connect, address, diagnose, loadMqtt, MQTT };
})();
// Grapevine - core. Your normal Grapevine account inside the launcher.
//
// It signs in to the real Grapevine server with the same recovery key, over the same encrypted relay
// link the full app uses on school networks (GVLink, see vendor/gvlink.js), and exposes a small API,
// window.HGGrapevine, that the launcher UI and every game with multiplayer can use:
//   HGGrapevine.me()                      -> { name, userId, pub, status } or null when nobody is signed in
//   HGGrapevine.on('change'|'friends'|'status', fn)
//   HGGrapevine.friendState(name)         -> 'self' | 'friend' | 'incoming' | 'outgoing' | 'none'
//   HGGrapevine.addFriend(name)           -> Promise (a friend request in main Grapevine, or an accept)
//   HGGrapevine.newChallenge()            -> random string a host gives to a joining player
//   HGGrapevine.prove(challenge, context) -> Promise<{ n, k, t, s }|null>  "I am <name>", signed with the account key
//   HGGrapevine.check(proof, challenge, context) -> Promise<{ ok, name, reason }>  verified against the server
//   HGGrapevine.sync                 cloud saves: every game's saved data follows the account to other devices
// Everything here only ever talks to Grapevine's server; nothing is sent to a game.
(function () {
  'use strict';
  if (window.HGGrapevine) return;

  var CFG = Object.assign({
    // Must match client.html's CONFIG in the Grapevine repo (archiveIds and serverPubs).
    archives: ['grapevine-a-f9c20eec06f3', 'grapevine-b-ae8b586e0081'],
    pinned: { 'grapevine-a-f9c20eec06f3': '114bee3b10b7d63870478007f5008b1dc5230389e4f5ad0786ef68b86a408ba0' },
    shards: 2,
    relays: undefined,          // tests point this at a local broker
    clientVersion: 'v12'
  }, window.HG_GV_CONFIG || {});

  // ---- storage that never throws ----
  var mem = {};
  var store = {
    get: function (k) { try { var v = localStorage.getItem('hgv:' + k); return v === null ? (mem[k] === undefined ? null : mem[k]) : v; } catch (e) { return mem[k] === undefined ? null : mem[k]; } },
    set: function (k, v) { mem[k] = String(v); try { localStorage.setItem('hgv:' + k, String(v)); } catch (e) {} },
    del: function (k) { delete mem[k]; try { localStorage.removeItem('hgv:' + k); } catch (e) {} }
  };
  var te = new TextEncoder();
  var randHex = function (n) { return ED.hex(crypto.getRandomValues(new Uint8Array(n))); };
  var sha256hex = function (s) { return crypto.subtle.digest('SHA-256', te.encode(s)).then(function (d) { return ED.hex(new Uint8Array(d)); }); };
  var newKey = function () { return btoa(String.fromCharCode.apply(null, crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

  // ---- state ----
  var st = {
    key: '', userId: '', name: '', pub: '', kp: null, conn: null, ready: false,
    status: 'signed-out', text: '', friends: [], incoming: [], outgoing: [], haveFriends: false,
    signup: false, wanted: '', invite: '', sendKey: false, cnonce: '', welcomeOk: false,
    idx: 0, fails: 0, timer: null, ping: null, lastHeard: 0, auth: null, pending: [], lookups: {}, gen: 0
  };
  var handlers = {};
  function on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return function () { off(ev, fn); }; }
  function off(ev, fn) { handlers[ev] = (handlers[ev] || []).filter(function (f) { return f !== fn; }); }
  function emit(ev, a) { (handlers[ev] || []).slice().forEach(function (f) { try { f(a); } catch (e) { console.error(e); } }); }
  function setStatus(s, t) { st.status = s; st.text = t || ''; emit('status', { status: s, text: st.text }); emit('change'); }

  // ---- connection ----
  var FATAL = { 'no-account': 1, 'bad-key': 1, 'banned': 1, 'name-taken': 1, 'bad-invite': 1, 'pow': 1, 'bad-sig': 1, 'old-client': 1, 'reg-limit': 1, 'flood': 1 };

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function connect() {
    if (!st.key || st.conn || st.timer) return;
    var gen = st.gen;
    var id = CFG.archives[st.idx % CFG.archives.length];
    setStatus('connecting', 'Connecting to Grapevine...');
    var c;
    try {
      c = GVLink.connect(id, {
        shards: CFG.shards, relays: CFG.relays, pinned: CFG.pinned[id] || '',
        verify: function (pub, msg, sig) { return ED.verify(pub, msg, sig); },
        onStatus: function (t) { if (st.conn === c && !st.ready) setStatus('connecting', t); }
      });
    } catch (e) { console.error(e); return retrySoon(); }
    st.conn = c; st.ready = false; st.welcomeOk = false; st.lastHeard = Date.now();
    var opened = false;
    c.on('open', function () { opened = true; st.fails = 0; });
    c.on('data', function (m) { if (st.conn === c && gen === st.gen) onFrame(c, m); });
    c.on('error', function (e) { console.warn('grapevine link:', e && e.type, e && e.message); });
    c.on('close', function (why) {
      if (st.conn !== c) return;
      st.conn = null; st.ready = false; clearInterval(st.ping);
      if (!st.key) return;
      if (!opened) { st.idx++; st.fails++; }
      if (st.auth && st.fails >= CFG.archives.length * 2 && !opened) failAuth(new Error(why === 'blocked' ? 'This network blocks the Grapevine relay servers.' : 'Could not reach the Grapevine server.'));
      setStatus(st.auth ? 'connecting' : 'offline', st.auth ? 'Reconnecting...' : 'Offline - trying again');
      retrySoon();
    });
  }

  function retrySoon() {
    if (st.timer || !st.key) return;
    var wait_ = Math.min(1000 * Math.pow(2, Math.min(st.fails, 5)), 20000) * (0.6 + Math.random() * 0.8);
    st.timer = setTimeout(function () { st.timer = null; connect(); }, wait_);
  }

  function drop() {            // sign out / switch account: nothing may linger
    st.gen++;
    clearTimeout(st.timer); st.timer = null; clearInterval(st.ping); clearInterval(sy.timer);
    var c = st.conn; st.conn = null; st.ready = false;
    try { c && c.close(); } catch (e) {}
  }

  function send(frame) {
    if (!st.conn || !st.conn.open) return false;
    try { st.conn.send(frame); return true; } catch (e) { return false; }
  }

  function failAuth(err) {
    var a = st.auth; st.auth = null;
    if (a) a.reject(err);
  }

  async function answerChallenge(c, m) {
    var archiveId = c.peer;
    var chalOk = typeof m.serverPub === 'string' && typeof m.sig === 'string' &&
      await ED.verify(m.serverPub, 'gv-challenge|' + m.nonce + '|' + c.pid, m.sig);
    var pinned = CFG.pinned[archiveId], known = store.get('srv:' + archiveId);
    var why = !chalOk ? 'did not prove who it is' : (pinned && pinned !== m.serverPub) ? 'is not the server this launcher was built for' : (known && known !== m.serverPub) ? 'is not the server you signed in to before' : '';
    if (why) { var e = new Error('The Grapevine server ' + why + '. Nothing was sent to it.'); e.fatal = true; failAuth(e); drop(); setStatus('error', e.message); return; }
    st.cnonce = randHex(16);
    var sig = ED.hex(await ED.sign(st.kp, 'gv-login|' + archiveId + '|' + m.nonce + '|' + c.pid + '|' + st.cnonce));
    var hello = { type: 'hello', v: 12, userId: st.userId, pub: st.pub, sig: sig, cnonce: st.cnonce, signup: st.signup,
      client: CFG.clientVersion, rl: 1, lite: 1 };
    if (st.signup) {
      hello.displayName = st.wanted || undefined;
      hello.invite = st.invite || undefined;
      if (m.pow > 0) { setStatus('connecting', 'Preparing your account...'); hello.pow = await proofOfWork(m.nonce + ':' + st.pub + ':', m.pow); }
    } else if (st.sendKey) hello.key = st.key;     // an account from before signed sign-in binds its key once
    if (st.conn === c && c.open) { try { c.send(hello); } catch (e2) {} }
  }

  async function onFrame(c, m) {
    if (!m || typeof m !== 'object') return;
    st.lastHeard = Date.now();
    switch (m.type) {
      case 'challenge': return answerChallenge(c, m);
      case 'welcome': {
        var ok = typeof m.serverPub === 'string' && typeof m.sig === 'string' &&
          await ED.verify(m.serverPub, 'gv-welcome|' + st.cnonce + '|' + c.pid + '|' + m.userId, m.sig);
        var pinned = CFG.pinned[c.peer], known = store.get('srv:' + c.peer);
        if (!ok || (pinned && pinned !== m.serverPub) || (known && known !== m.serverPub)) {
          var e = new Error('The Grapevine server could not prove who it is. Nothing more was sent.'); failAuth(e); drop(); setStatus('error', e.message); return;
        }
        if (!known) store.set('srv:' + c.peer, m.serverPub);
        if (st.conn !== c) return;
        st.welcomeOk = true; st.ready = true; st.sendKey = false;
        st.userId = m.userId; st.name = m.displayName || st.name;
        store.set('name', st.name);
        st.signup = false;
        setStatus('online', 'Connected to Grapevine');
        clearInterval(st.ping);
        st.ping = setInterval(function () {
          if (!st.ready) return;
          if (Date.now() - st.lastHeard > 25000) { try { c.close(); } catch (e3) {} return; }
          send({ type: 'ping' });
        }, 8000);
        send({ type: 'friendsList' });
        startSync();
        var a = st.auth; st.auth = null; if (a) a.resolve({ name: st.name, userId: st.userId });
        return;
      }
      case 'friends':
        st.friends = (m.friends || []).map(function (f) { return { name: f.name, userId: f.userId, online: !!f.online }; });
        st.incoming = (m.incoming || []).map(function (f) { return { name: f.name, userId: f.userId, at: f.at }; });
        st.outgoing = (m.outgoing || []).map(function (f) { return { name: f.name, userId: f.userId, at: f.at }; });
        st.haveFriends = true;
        store.set('friends', JSON.stringify({ f: st.friends, i: st.incoming, o: st.outgoing }));
        settlePending(null);
        emit('friends'); emit('change');
        return;
      case 'profile': {
        var cb = st.lookups[m.name];
        if (cb) { delete st.lookups[m.name]; cb.forEach(function (f) { f(m); }); }
        return;
      }
      case 'saves': return rpcDone('saves', m);
      case 'savesData': return rpcDone('savesData', m);
      case 'ok': if (m.op === 'savesPut') return rpcDone('savesPut', m); return;
      case 'error': return onError(c, m);
      case 'pong': return;
    }
  }

  function onError(c, m) {
    var code = m.code || '';
    if (code === 'rate') { rpcFail(new Error('Slow down a little.')); settlePending(new Error('Slow down a little.')); return; }
    if (code === 'rebind' && !st.sendKey && st.auth) { st.sendKey = true; try { c.close(); } catch (e) {} return; }   // retry once, sending the key to bind it
    if (code === 'full') { st.idx++; try { c.close(); } catch (e) {} return; }
    if (code === 'no-such-name') {
      // a failed profile lookup or friend request: tell whoever asked
      Object.keys(st.lookups).forEach(function (n) { var cbs = st.lookups[n]; delete st.lookups[n]; cbs.forEach(function (f) { f(null); }); });
    }
    if (FATAL[code] || (st.auth && !st.ready)) {
      var err = new Error(m.text || code); err.code = code;
      failAuth(err);
      if (FATAL[code]) { drop(); setStatus('error', err.message); }
      return;
    }
    rpcFail(new Error(m.text || code));
    settlePending(new Error(m.text || code));
  }

  // friend operations resolve when the server's next friends picture arrives, or fail with its refusal
  function settlePending(err) {
    var p = st.pending.shift();
    if (!p) return;
    clearTimeout(p.t);
    if (err) p.reject(err); else p.resolve();
    if (!err) while (st.pending.length) { var q = st.pending.shift(); clearTimeout(q.t); q.resolve(); }
  }
  function friendOp(type, name) {
    name = String(name || '').trim();
    if (!name) return Promise.reject(new Error('Type a name first.'));
    if (!st.ready) return Promise.reject(new Error('Not connected to Grapevine yet.'));
    return new Promise(function (resolve, reject) {
      var p = { resolve: resolve, reject: reject, t: setTimeout(function () { var i = st.pending.indexOf(p); if (i >= 0) st.pending.splice(i, 1); reject(new Error('Grapevine did not answer. Try again.')); }, 9000) };
      st.pending.push(p);
      if (!send({ type: type, name: name })) { clearTimeout(p.t); st.pending.splice(st.pending.indexOf(p), 1); reject(new Error('Not connected to Grapevine yet.')); }
    });
  }

  // ---- sign in / up / out ----
  async function begin(key, signup, name, invite, soft) {
    key = String(key || '').trim();
    if (key.length < 32 || key.length > 200) throw new Error('That does not look like a recovery key.');
    if (!window.crypto || !crypto.subtle) throw new Error('Needs a secure (https) page.');
    drop();
    st.key = key; st.signup = !!signup; st.wanted = String(name || '').trim().slice(0, 24); st.invite = String(invite || '').trim();
    st.sendKey = false; st.friends = []; st.incoming = []; st.outgoing = []; st.haveFriends = false;
    st.userId = await sha256hex(key);
    if (store.get('uid') && store.get('uid') !== st.userId) wipeDevice();   // somebody else's leftovers never join this account
    store.set('uid', st.userId);
    var seed = new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode('gv-seed|' + key)));
    st.kp = await ED.keypair(seed); st.pub = ED.hex(st.kp.pub);
    st.fails = 0; st.idx = Math.floor(Math.random() * CFG.archives.length);
    var done = new Promise(function (resolve, reject) { st.auth = { resolve: resolve, reject: reject }; });
    connect();
    var t = setTimeout(function () { failAuth(new Error('Grapevine did not answer. Check /diag in Grapevine or try again on another network.')); }, 60000);
    try { var r = await done; clearTimeout(t); store.set('key', key); store.set('name', r.name); return r; }
    catch (e) {
      clearTimeout(t);
      var fatal = e.fatal || (e.code && FATAL[e.code]);
      if (soft && !fatal) return null;          // a saved account on a bad network keeps trying in the background
      drop(); st.key = '';
      if (!e.fatal) setStatus('signed-out', '');
      throw e;
    }
  }
  function signIn(key) { return begin(key, false); }
  function signUp(key, name, invite) { return begin(key, true, name, invite); }
  // Signing out saves everything to the account first, then clears this device, so the next person at a shared
  // Chromebook starts clean and nobody's progress leaks into somebody else's account. Returns { saved: bool }.
  async function signOut(opts) {
    var saved = false;
    if (st.ready) { try { await syncRun({ noApply: true }); saved = true; } catch (e) {} }
    if (!saved && !(opts && opts.force)) return { saved: false };
    drop(); st.key = ''; st.userId = ''; st.name = ''; st.pub = ''; st.kp = null; st.friends = []; st.incoming = []; st.outgoing = []; st.haveFriends = false;
    wipeDevice();
    ['key', 'name', 'friends', 'uid', 'met'].forEach(store.del);
    setStatus('signed-out', ''); emit('friends');
    return { saved: saved };
  }
  // a saved session comes back by itself
  function resume() {
    var k = store.get('key');
    if (!k || st.key) return Promise.resolve(null);
    st.name = store.get('name') || '';
    try { var f = JSON.parse(store.get('friends') || 'null'); if (f) { st.friends = (f.f || []).map(function (x) { x.online = false; return x; }); st.incoming = f.i || []; st.outgoing = f.o || []; } } catch (e) {}
    return begin(k, false, '', '', true).catch(function (e) { if (e && e.code === 'no-account') { signOut(); } return null; });
  }

  // ---- a compact SHA-256 for the sign-up proof (WebCrypto is too slow per call for ~65k digests) ----
  var SHA256 = (function () {
    var K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
    var W = new Uint32Array(64);
    return function (bytes) {
      var len = bytes.length, bits = len * 8, padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
      padded.set(bytes); padded[len] = 0x80;
      var dv = new DataView(padded.buffer); dv.setUint32(padded.length - 4, bits >>> 0); dv.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));
      var h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
      for (var off = 0; off < padded.length; off += 64) {
        var i;
        for (i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
        for (i = 16; i < 64; i++) { var a1 = W[i-15], b1 = W[i-2];
          W[i] = (W[i-16] + (((a1>>>7)|(a1<<25)) ^ ((a1>>>18)|(a1<<14)) ^ (a1>>>3)) + W[i-7] + (((b1>>>17)|(b1<<15)) ^ ((b1>>>19)|(b1<<13)) ^ (b1>>>10))) | 0; }
        var a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
        for (i = 0; i < 64; i++) {
          var t1 = (h + (((e>>>6)|(e<<26)) ^ ((e>>>11)|(e<<21)) ^ ((e>>>25)|(e<<7))) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
          var t2 = ((((a>>>2)|(a<<30)) ^ ((a>>>13)|(a<<19)) ^ ((a>>>22)|(a<<10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
          h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
        }
        h0=(h0+a)|0;h1=(h1+b)|0;h2=(h2+c)|0;h3=(h3+d)|0;h4=(h4+e)|0;h5=(h5+f)|0;h6=(h6+g)|0;h7=(h7+h)|0;
      }
      var out = new Uint8Array(32), ov = new DataView(out.buffer);
      [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function (v, j) { ov.setUint32(j * 4, v >>> 0); });
      return out;
    };
  })();
  async function proofOfWork(prefix, bits) {
    for (var n = 0; ; n++) {
      var nonce = n.toString(36), h = SHA256(te.encode(prefix + nonce)), zeros = 0;
      for (var i = 0; i < h.length; i++) { if (h[i] === 0) { zeros += 8; continue; } zeros += Math.clz32(h[i]) - 24; break; }
      if (zeros >= bits) return nonce;
      if ((n & 2047) === 0) await wait(0);
    }
  }

  // ---- cloud saves ----
  // Every game keeps its progress in localStorage, and the games all run on the launcher's page, so the launcher can
  // carry the lot. Per key: a hash and a "changed at" time, newest wins; the server keeps one row per key.
  // Rules that keep it safe:
  //  * a device meeting an account for the first time lets the cloud win conflicts (and keeps the overwritten value
  //    under hgv:bak:<key>), so a fresh Chromebook never wipes real progress;
  //  * nothing is written into localStorage while a game is open (the game would overwrite it from memory anyway);
  //    it waits until the game closes;
  //  * signing out saves first and then clears the device.
  // Only the games' own keys travel (the launcher's page origin can hold other sites' data too). A new game's keys
  // must be added here: it is the list of prefixes the games write.
  var GAME_KEYS = CFG.saveKeys || /^(spikes100_|blocky|huntington|brownEClicker|beanBrew|neon|tetrisHighScore|frontline_|lifeScorePB|marketLife|netWorthPB|td2_|td-)/;
  var SAVE_MAX = 400000;
  var sy = { running: null, state: 'idle', text: '', at: Number(store.get('syncat') || 0), n: 0, timer: null, open: false, first: null, waiters: {} };
  function syncMeta() { try { return JSON.parse(store.get('sync') || '{}'); } catch (e) { return {}; } }
  function setSync(state, text) { sy.state = state; sy.text = text || ''; emit('sync', { state: state, text: sy.text, at: sy.at }); }
  function eligible() {
    var out = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && GAME_KEYS.test(k)) out.push(k); } } catch (e) {}
    return out;
  }
  function wipeDevice() { try { eligible().forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} store.del('sync'); store.del('syncat'); sy.at = 0; }
  function rpc(frame, reply) {
    return new Promise(function (resolve, reject) {
      var w = { resolve: resolve, reject: reject, t: setTimeout(function () { var l = sy.waiters[reply] || []; var i = l.indexOf(w); if (i >= 0) l.splice(i, 1); reject(new Error('Grapevine did not answer.')); }, 20000) };
      (sy.waiters[reply] = sy.waiters[reply] || []).push(w);
      if (!send(frame)) { clearTimeout(w.t); sy.waiters[reply].pop(); reject(new Error('Not connected.')); }
    });
  }
  function rpcDone(reply, m) { var w = (sy.waiters[reply] || []).shift(); if (w) { clearTimeout(w.t); w.resolve(m); } }
  function rpcFail(err) { Object.keys(sy.waiters).forEach(function (k) { var l = sy.waiters[k]; sy.waiters[k] = []; l.forEach(function (w) { clearTimeout(w.t); w.reject(err); }); }); }

  function syncRun(opts) {
    if (sy.running) return sy.running;
    if (!st.ready) return Promise.reject(new Error('Not connected to Grapevine.'));
    opts = opts || {};
    var p = (async function () {
      setSync('syncing', 'Syncing your saves...');
      var meta = syncMeta(), now = Date.now(), local = {}, firstOnDevice = !store.get('syncat');
      var keys = eligible(), seen = {};
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i], v = localStorage.getItem(k);
        if (v == null || v.length > SAVE_MAX) continue;
        var h = await sha256hex(v);
        if (!meta[k] || meta[k].h !== h) meta[k] = { h: h, t: now };
        local[k] = { v: v, h: h, t: meta[k].t }; seen[k] = 1;
      }
      Object.keys(meta).forEach(function (k) { if (!seen[k]) delete meta[k]; });
      var list = (await rpc({ type: 'savesList' }, 'saves')).items || [];
      var srv = {}; list.forEach(function (it) { srv[it.k] = it; });
      var need = [], put = [];
      Object.keys(srv).forEach(function (k) {
        var l = local[k];
        if (!l) need.push(k);
        else if (l.h !== srv[k].h) { if (firstOnDevice || srv[k].at > l.t) need.push(k); else put.push(k); }
      });
      Object.keys(local).forEach(function (k) { if (!srv[k]) put.push(k); });
      var pulled = 0, deferred = 0;
      if (need.length && (sy.open || opts.noApply)) { deferred = need.length; need = []; }
      for (var j = 0; j < need.length; j += 10) {
        var got = await rpc({ type: 'savesGet', keys: need.slice(j, j + 10) }, 'savesData');
        for (var g = 0; g < (got.items || []).length; g++) {
          var it = got.items[g], old = localStorage.getItem(it.k);
          if (old != null && old !== it.v) { try { localStorage.setItem('hgv:bak:' + it.k, old); } catch (e) {} }
          try { localStorage.setItem(it.k, it.v); } catch (e) { continue; }
          meta[it.k] = { h: srv[it.k] ? srv[it.k].h : await sha256hex(it.v), t: it.at };
          pulled++;
        }
      }
      var pushed = 0, batch = [], size = 0;
      async function flush() { if (!batch.length) return; var r = await rpc({ type: 'savesPut', items: batch }, 'savesPut'); pushed += r.stored || 0; batch = []; size = 0; }
      for (var q = 0; q < put.length; q++) {
        var pk = put[q], pv = local[pk];
        if (batch.length >= 20 || size + pv.v.length > 900000) await flush();
        batch.push({ k: pk, v: pv.v, at: pv.t }); size += pv.v.length;
      }
      await flush();
      store.set('sync', JSON.stringify(meta));
      sy.at = Date.now(); store.set('syncat', String(sy.at)); sy.n = Object.keys(local).length + pulled;
      setSync('ok', deferred ? 'Saved. Newer saves from another device load when you close the game.' : 'All saves are in your account.');
      return { pulled: pulled, pushed: pushed, deferred: deferred };
    })();
    sy.running = p;
    var done = function () { sy.running = null; };
    p.then(done, function (e) { done(); setSync('error', 'Could not sync: ' + (e && e.message)); });
    return p;
  }
  function startSync() {
    clearInterval(sy.timer);
    sy.first = syncRun().then(function () {}, function () {});
    sy.timer = setInterval(function () { if (st.ready) syncRun().catch(function () {}); }, 45000);
  }

  // ---- who is this person? (for games) ----
  function lookupPub(name) {
    return new Promise(function (resolve) {
      var hit = lookupCache[name];
      if (hit && Date.now() - hit.at < 120000) return resolve(hit.pub);
      if (!st.ready) return resolve(null);
      var list = st.lookups[name] = st.lookups[name] || [];
      var t = setTimeout(function () { var i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); resolve(null); }, 6000);
      function fn(m) { clearTimeout(t); var pub = m && m.pub ? String(m.pub) : null; if (pub) lookupCache[name] = { pub: pub, at: Date.now() }; resolve(pub); }
      list.push(fn);
      if (list.length === 1) send({ type: 'profileGet', name: name });
    });
  }
  var lookupCache = {};
  var proofMsg = function (context, challenge, name, ts) { return 'gv-game|' + context + '|' + challenge + '|' + name + '|' + ts; };

  async function prove(challenge, context) {
    if (!st.kp || !st.name) return null;
    var t = Date.now();
    var s = ED.hex(await ED.sign(st.kp, proofMsg(context, challenge, st.name, t)));
    return { n: st.name, k: st.pub, t: t, s: s };
  }
  async function check(proof, challenge, context) {
    try {
      if (!proof || typeof proof.n !== 'string' || typeof proof.k !== 'string' || typeof proof.s !== 'string' || typeof proof.t !== 'number') return { ok: false, reason: 'none' };
      if (Math.abs(Date.now() - proof.t) > 5 * 60000) return { ok: false, reason: 'stale' };
      if (!(await ED.verify(proof.k, proofMsg(context, challenge, proof.n, proof.t), proof.s))) return { ok: false, reason: 'bad-signature' };
      if (!st.ready) return { ok: false, reason: 'offline', name: proof.n };
      var pub = await lookupPub(proof.n);
      if (!pub) return { ok: false, reason: 'unknown', name: proof.n };
      if (pub !== proof.k) return { ok: false, reason: 'impostor', name: proof.n };
      return { ok: true, name: proof.n };
    } catch (e) { return { ok: false, reason: 'error' }; }
  }

  // ---- people met in games ----
  function recent() { try { return JSON.parse(store.get('met') || '[]'); } catch (e) { return []; } }
  function noteMet(name, game) {
    name = String(name || '').slice(0, 24);
    if (!name || name === st.name) return;
    var list = recent().filter(function (r) { return r.name !== name; });
    list.unshift({ name: name, game: String(game || '').slice(0, 40), at: Date.now() });
    store.set('met', JSON.stringify(list.slice(0, 40)));
    emit('met');
  }

  function friendState(name) {
    if (!name) return 'none';
    if (name === st.name) return 'self';
    if (st.friends.some(function (f) { return f.name === name; })) return 'friend';
    if (st.incoming.some(function (f) { return f.name === name; })) return 'incoming';
    if (st.outgoing.some(function (f) { return f.name === name; })) return 'outgoing';
    return 'none';
  }

  window.HGGrapevine = {
    version: 1,
    config: CFG,
    me: function () { return st.name ? { name: st.name, userId: st.userId, pub: st.pub, status: st.status } : null; },
    status: function () { return { status: st.status, text: st.text }; },
    online: function () { return st.ready; },
    friends: function () { return { friends: st.friends.slice(), incoming: st.incoming.slice(), outgoing: st.outgoing.slice(), loaded: st.haveFriends }; },
    friendState: friendState,
    addFriend: function (n) { return friendOp('friendRequest', n); },
    acceptFriend: function (n) { return friendOp('friendAccept', n); },
    declineFriend: function (n) { return friendOp('friendDecline', n); },
    removeFriend: function (n) { return friendOp('friendRemove', n); },
    newKey: newKey,
    signIn: signIn, signUp: signUp, signOut: signOut, resume: resume,
    key: function () { return st.key; },
    newChallenge: function () { return randHex(12); },
    prove: prove, check: check,
    recent: recent, noteMet: noteMet,
    on: on, off: off,
    ready: function () { return readyP; },
    sync: {
      run: function () { return syncRun(); },
      status: function () { return { state: sy.state, text: sy.text, at: sy.at, n: sy.n }; },
      // resolves when the first sync after sign-in is done, or after `ms`, so a game is not launched before it
      first: function (ms) { return Promise.race([sy.first || Promise.resolve(), new Promise(function (r) { setTimeout(r, ms || 2500); })]); },
      setGameOpen: function (open) { sy.open = !!open; if (!open && st.ready) syncRun().catch(function () {}); }
    },
    diagnose: function () { return GVLink.diagnose({ relays: CFG.relays }); }
  };
  var readyP = Promise.resolve();
})();
// Grapevine - the launcher tab. Draws into any element with HGGrapevineUI.mount(el).
// Styled by the launcher's Grapevine theme variables (--panel, --raise, --line, --signal ...); the
// small stylesheet below only uses those, so it follows the theme wherever it is mounted.
(function () {
  'use strict';
  if (window.HGGrapevineUI) return;
  var L = window.HGGrapevine;

  var css = [
    '.gl{max-width:640px;margin:0 auto;font-family:var(--sans)}',
    '.gl *{box-sizing:border-box}',
    '.gl .k{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}',
    '.gl .sect{font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--dimmer);padding:16px 2px 6px}',
    '.gl h2{margin:0 0 4px;font-family:var(--mono);font-weight:600;font-size:14px;letter-spacing:.28em;text-transform:uppercase;color:var(--signal)}',
    '.gl p.sub{color:var(--dim);font-size:13px;margin:0 0 18px;line-height:1.55}',
    '.gl .card{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:18px}',
    '.gl .field{margin-bottom:14px}',
    '.gl .field label{display:block;font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}',
    '.gl input[type=text],.gl input[type=password]{width:100%;background:var(--ground);border:1px solid var(--line);color:var(--text);padding:10px 12px;border-radius:3px;font-family:var(--mono);font-size:13px;outline:none;transition:border-color .15s}',
    '.gl input:focus{border-color:var(--signal)}',
    '.gl .hint{font-size:12px;color:var(--dim);margin-top:5px;line-height:1.5}',
    '.gl .hint.bad{color:var(--danger)}',
    '.gl .go{width:100%;background:linear-gradient(100deg,var(--signal),var(--signal2));color:var(--on-signal);border:0;padding:11px;border-radius:3px;box-shadow:0 6px 22px color-mix(in srgb,var(--signal) 28%,transparent);font-family:var(--mono);font-weight:600;font-size:12px;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;margin-top:6px}',
    '.gl .go:hover{filter:brightness(1.1)}.gl .go:disabled{opacity:.45;cursor:default;filter:none}',
    '.gl .mbtn{background:var(--raise);border:1px solid var(--line2);border-radius:3px;padding:7px 12px;font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--text);cursor:pointer}',
    '.gl .mbtn:hover{border-color:var(--signal);color:var(--signal)}',
    '.gl .mbtn.warn{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 45%,transparent)}.gl .mbtn.warn:hover{border-color:var(--danger)}',
    '.gl .mbtn:disabled{opacity:.5;cursor:default}',
    '.gl .seg{display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--line)}',
    '.gl .seg button{background:none;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:8px 12px;font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);cursor:pointer}',
    '.gl .seg button:hover{color:var(--text)}.gl .seg button.on{color:var(--signal);border-bottom-color:var(--signal)}',
    '.gl .me{display:flex;align-items:center;gap:12px;margin-bottom:16px}',
    '.gl .av{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none;background:linear-gradient(135deg,var(--signal),var(--signal2));color:var(--on-signal);font-family:var(--mono);font-weight:600;font-size:17px}',
    '.gl .me .nm{font-weight:600;font-size:17px}',
    '.gl .me .st{font-size:12px;color:var(--dim);display:flex;align-items:center;gap:6px}',
    '.gl .me .sp{flex:1}',
    '.gl .dot{width:8px;height:8px;border-radius:50%;background:var(--dimmer);flex:none;display:inline-block}',
    '.gl .dot.on{background:var(--live);box-shadow:0 0 8px color-mix(in srgb,var(--live) 60%,transparent)}',
    '.gl .dot.wait{background:var(--signal)}.gl .dot.bad{background:var(--danger)}',
    '.gl .row{display:flex;align-items:center;gap:10px;padding:9px 4px;border-top:1px solid var(--line)}',
    '.gl .row:first-child{border-top:0}',
    '.gl .row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}',
    '.gl .row .sm{font-size:11.5px;color:var(--dim)}',
    '.gl .row .btns{display:flex;gap:6px;flex:none}',
    '.gl .add{display:flex;gap:8px;margin-bottom:6px}.gl .add input{flex:1}',
    '.gl .empty{color:var(--dim);font-size:13px;padding:18px 4px;line-height:1.6}',
    '.gl .keybox{font-family:var(--mono);font-size:13px;word-break:break-all;background:var(--ground);border:1px dashed var(--signal);border-radius:3px;padding:12px;margin:10px 0;user-select:all}',
    '.gl .chk{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--dim);margin:10px 0}',
    '.gl .diag{font-family:var(--mono);font-size:12px;line-height:1.7;margin-top:10px}',
    '.gl .diag .ok{color:var(--live)}.gl .diag .no{color:var(--danger)}',
    '.gl .toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:var(--raise);border:1px solid var(--line2);border-radius:3px;padding:9px 14px;font-size:13px;z-index:30;max-width:90vw}',
    '.gl .toast.bad{border-color:var(--danger);color:var(--danger)}'
  ].join('\n');

  function h(tag, attrs) {
    var e = document.createElement(tag), i, c;
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) {
      c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) { c.forEach(function (x) { if (x) e.appendChild(x); }); continue; }
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  var root, gate = false, mounts = [], view = 'friends', mode = 'in', pendingKey = null, toastT = null, busy = false, diagHtml = null;

  function toast(msg, bad) {
    var old = document.getElementById('gl-toast'); if (old) old.remove();
    var w = h('div', { class: 'gl', id: 'gl-toast' }, h('div', { class: 'toast' + (bad ? ' bad' : ''), text: msg, role: 'status' }));
    document.body.appendChild(w); clearTimeout(toastT); toastT = setTimeout(function () { w.remove(); }, 4200);
  }
  function statusDot() {
    var s = L.status().status;
    return s === 'online' ? 'on' : (s === 'connecting' || s === 'offline') ? 'wait' : s === 'error' ? 'bad' : '';
  }
  function statusLine() {
    var s = L.status();
    if (s.status === 'online') return 'Connected to Grapevine';
    if (s.status === 'connecting') return s.text || 'Connecting...';
    if (s.status === 'offline') return 'Offline - trying again';
    if (s.status === 'error') return s.text || 'Something went wrong';
    return '';
  }

  // ---------------- signed out ----------------
  function signedOut() {
    var wrap = h('div', { class: 'card' });
    wrap.appendChild(h('h2', { text: 'Grapevine' }));
    wrap.appendChild(h('p', { class: 'sub', text: gate
      ? 'One account for everything here. Your name in every game, your saves on every device, and friends, chat and rooms in Grapevine. Sign in with your recovery key, or create an account to get started.'
      : 'Your Grapevine account.' }));
    var seg = h('div', { class: 'seg' },
      h('button', { class: mode === 'in' ? 'on' : '', text: 'Sign in', onclick: function () { mode = 'in'; pendingKey = null; render(); } }),
      h('button', { class: mode === 'up' ? 'on' : '', text: 'Create account', onclick: function () { mode = 'up'; pendingKey = null; render(); } }));
    wrap.appendChild(seg);
    var hint = h('div', { class: 'hint' });
    var go;
    if (mode === 'in') {
      var key = h('input', { type: 'password', id: 'gl-key', autocomplete: 'off', spellcheck: 'false', placeholder: 'paste your recovery key' });
      var show = h('label', { class: 'chk' }, h('input', { type: 'checkbox', onchange: function () { key.type = this.checked ? 'text' : 'password'; } }), 'Show the key');
      go = h('button', { class: 'go', id: 'gl-go', text: 'Sign in', onclick: function () {
        if (busy) return;
        busy = true; go.disabled = true; hint.className = 'hint'; hint.textContent = 'Signing in...';
        L.signIn(key.value).then(function () { busy = false; render(); }, function (e) { busy = false; go.disabled = false; hint.className = 'hint bad'; hint.textContent = e.message || 'Could not sign in.'; });
      } });
      key.onkeydown = function (e) { if (e.key === 'Enter') go.click(); };
      wrap.appendChild(h('div', { class: 'field' }, h('label', { text: 'Recovery key' }), key, hint));
      wrap.appendChild(show);
      wrap.appendChild(go);
      wrap.appendChild(h('p', { class: 'hint', text: 'It is the same key you use in Grapevine. It stays on this device and is never shown to games.' }));
    } else if (!pendingKey) {
      var nm = h('input', { type: 'text', id: 'gl-name', maxlength: '24', autocomplete: 'off', placeholder: 'pick a name' });
      var inv = h('input', { type: 'text', id: 'gl-invite', autocomplete: 'off', placeholder: 'only if the server asks for one' });
      go = h('button', { class: 'go', id: 'gl-go', text: 'Create account', onclick: function () {
        if (!nm.value.trim()) { hint.className = 'hint bad'; hint.textContent = 'Pick a name first.'; return; }
        pendingKey = { key: L.newKey(), name: nm.value.trim(), invite: inv.value.trim() }; render();
      } });
      nm.onkeydown = function (e) { if (e.key === 'Enter') go.click(); };
      wrap.appendChild(h('div', { class: 'field' }, h('label', { text: 'Name' }), nm, hint,
        h('div', { class: 'hint', text: 'Names are case-sensitive and first come, first served. This is the name other players see.' })));
      wrap.appendChild(h('div', { class: 'field' }, h('label', { text: 'Invite code (optional)' }), inv));
      wrap.appendChild(go);
    } else {
      var saved = h('input', { type: 'checkbox', id: 'gl-saved', onchange: function () { fin.disabled = !this.checked; } });
      var fin = h('button', { class: 'go', id: 'gl-fin', text: 'Create it', disabled: 'disabled', onclick: function () {
        if (busy) return;
        busy = true; fin.disabled = true; hint.className = 'hint'; hint.textContent = 'Creating your account...';
        L.signUp(pendingKey.key, pendingKey.name, pendingKey.invite).then(function () { pendingKey = null; busy = false; render(); },
          function (e) { busy = false; pendingKey = null; mode = 'up'; render(); toast(e.message || 'Could not create the account.', true); });
      } });
      wrap.appendChild(h('div', { class: 'k', text: 'Your recovery key' }));
      wrap.appendChild(h('div', { class: 'keybox', id: 'gl-newkey', text: pendingKey.key }));
      wrap.appendChild(h('button', { class: 'mbtn', text: 'Copy', onclick: function () { copy(pendingKey.key, 'Key copied - now paste it somewhere safe.'); } }));
      wrap.appendChild(h('p', { class: 'hint', text: 'This key IS your account. Nobody can reset it - not even us. Save it in a password manager or a note before you go on.' }));
      wrap.appendChild(h('label', { class: 'chk' }, saved, 'I saved my key somewhere safe'));
      wrap.appendChild(hint);
      wrap.appendChild(fin);
    }
    return wrap;
  }

  function copy(text, msg) {
    var done = function () { toast(msg); };
    try { navigator.clipboard.writeText(text).then(done, function () { toast('Select it and copy it by hand.', true); }); }
    catch (e) { toast('Select it and copy it by hand.', true); }
  }

  // ---------------- signed in ----------------
  function signedIn() {
    var me = L.me(), f = L.friends();
    var wrap = h('div');
    wrap.appendChild(h('div', { class: 'me' },
      h('div', { class: 'av', text: me.name.slice(0, 1).toUpperCase() }),
      h('div', null, h('div', { class: 'nm', id: 'gl-me', text: me.name }), h('div', { class: 'st' }, h('span', { class: 'dot ' + statusDot() }), h('span', { id: 'gl-status', text: statusLine() }))),
      h('div', { class: 'sp' }),
      h('button', { class: 'mbtn', text: 'My key', title: 'Copy your recovery key', onclick: function () { copy(L.key(), 'Key copied. Keep it private.'); } }),
      h('button', { class: 'mbtn warn', id: 'gl-out', text: 'Sign out', onclick: function () {
        var b = this; b.disabled = true;
        L.signOut().then(function (r) {
          if (r.saved) { view = 'friends'; render(); return; }
          if (confirm('Grapevine could not save your games to your account right now (no connection). Signing out would clear them from this device. Sign out anyway?')) { L.signOut({ force: true }).then(function () { view = 'friends'; render(); }); }
          else b.disabled = false;
        });
      } })));
    var nIn = f.incoming.length;
    var tabs = [['friends', 'Friends'], ['requests', 'Requests' + (nIn ? ' (' + nIn + ')' : '')], ['met', 'Met in games'], ['saves', 'Saves'], ['conn', 'Connection']];
    wrap.appendChild(h('div', { class: 'seg' }, tabs.map(function (t) {
      return h('button', { class: view === t[0] ? 'on' : '', 'data-view': t[0], text: t[1], onclick: function () { view = t[0]; render(); } });
    })));
    wrap.appendChild(view === 'friends' ? friendsView(f) : view === 'requests' ? requestsView(f) : view === 'met' ? metView() : view === 'saves' ? savesView() : connView());
    return wrap;
  }

  function act(btn, p, okMsg) {
    btn.disabled = true;
    p.then(function () { if (okMsg) toast(okMsg); }, function (e) { toast(e.message || 'That did not work.', true); }).then(function () { btn.disabled = false; });
  }

  function friendsView(f) {
    var box = h('div');
    var inp = h('input', { type: 'text', id: 'gl-add', maxlength: '24', autocomplete: 'off', placeholder: 'add a friend by exact name' });
    var btn = h('button', { class: 'mbtn', id: 'gl-add-go', text: 'Add', onclick: function () {
      var n = inp.value.trim(); if (!n) return;
      act(btn, L.addFriend(n).then(function () { inp.value = ''; }), L.friendState(n) === 'incoming' ? 'You are now friends with ' + n : 'Friend request sent to ' + n);
    } });
    inp.onkeydown = function (e) { if (e.key === 'Enter') btn.click(); };
    box.appendChild(h('div', { class: 'add' }, inp, btn));
    box.appendChild(h('div', { class: 'hint', text: 'Names are case-sensitive. Friends you make here are your friends in Grapevine too.' }));
    var online = f.friends.filter(function (x) { return x.online; }).length;
    box.appendChild(h('div', { class: 'sect', text: 'friends - ' + online + ' online of ' + f.friends.length }));
    if (!f.friends.length) box.appendChild(h('div', { class: 'empty', text: f.loaded ? 'No friends yet. Add someone above, or play multiplayer and tap + Friend next to a player.' : 'Loading your friends...' }));
    f.friends.forEach(function (x) {
      var rm = h('button', { class: 'mbtn warn', text: 'Remove', onclick: function () { if (confirm('Remove ' + x.name + ' from your friends?')) act(rm, L.removeFriend(x.name), x.name + ' removed'); } });
      box.appendChild(h('div', { class: 'row', 'data-friend': x.name }, h('span', { class: 'dot ' + (x.online ? 'on' : '') }), h('span', { class: 'nm', text: x.name }), h('span', { class: 'sm', text: x.online ? 'online' : 'offline' }), h('span', { class: 'btns' }, rm)));
    });
    return box;
  }

  function requestsView(f) {
    var box = h('div');
    box.appendChild(h('div', { class: 'sect', text: 'asked to be your friend' }));
    if (!f.incoming.length) box.appendChild(h('div', { class: 'empty', text: 'No one is waiting on you.' }));
    f.incoming.forEach(function (x) {
      var ok = h('button', { class: 'mbtn', text: 'Accept', onclick: function () { act(ok, L.acceptFriend(x.name), 'You are now friends with ' + x.name); } });
      var no = h('button', { class: 'mbtn warn', text: 'Decline', onclick: function () { act(no, L.declineFriend(x.name)); } });
      box.appendChild(h('div', { class: 'row', 'data-incoming': x.name }, h('span', { class: 'nm', text: x.name }), h('span', { class: 'btns' }, ok, no)));
    });
    box.appendChild(h('div', { class: 'sect', text: 'you asked' }));
    if (!f.outgoing.length) box.appendChild(h('div', { class: 'empty', text: 'No requests sent.' }));
    f.outgoing.forEach(function (x) {
      var no = h('button', { class: 'mbtn warn', text: 'Cancel', onclick: function () { act(no, L.declineFriend(x.name)); } });
      box.appendChild(h('div', { class: 'row', 'data-outgoing': x.name }, h('span', { class: 'nm', text: x.name }), h('span', { class: 'sm', text: 'waiting' }), h('span', { class: 'btns' }, no)));
    });
    return box;
  }

  function metView() {
    var box = h('div'), list = L.recent();
    box.appendChild(h('div', { class: 'sect', text: 'people you played with' }));
    if (!list.length) box.appendChild(h('div', { class: 'empty', text: 'When you play multiplayer, verified players show up here so you can friend them.' }));
    list.forEach(function (r) {
      var s = L.friendState(r.name), right;
      if (s === 'none') { right = h('button', { class: 'mbtn', text: '+ Friend', onclick: function () { act(this, L.addFriend(r.name), 'Friend request sent to ' + r.name); } }); }
      else right = h('span', { class: 'sm', text: s === 'friend' ? 'friends' : s === 'outgoing' ? 'request sent' : s === 'incoming' ? 'asked you' : '' });
      box.appendChild(h('div', { class: 'row', 'data-met': r.name }, h('span', { class: 'nm', text: r.name }), h('span', { class: 'sm', text: r.game || '' }), h('span', { class: 'btns' }, right)));
    });
    return box;
  }

  function ago(t) {
    if (!t) return 'never';
    var s = Math.round((Date.now() - t) / 1000);
    return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago';
  }
  function savesView() {
    var box = h('div'), st = L.sync.status();
    box.appendChild(h('div', { class: 'sect', text: 'saves and devices' }));
    box.appendChild(h('p', { class: 'sub', text: 'Every game\'s progress is saved to your account. Sign in on another device with the same recovery key and it all loads there. Saves are kept up to date automatically; closing a game saves it right away.' }));
    box.appendChild(h('div', { class: 'row' }, h('span', { class: 'dot ' + (st.state === 'ok' ? 'on' : st.state === 'error' ? 'bad' : 'wait') }),
      h('span', { class: 'nm', id: 'gl-sync', text: st.text || (st.at ? 'Last saved ' + ago(st.at) : 'Not saved yet') }), h('span', { class: 'sm', text: st.at ? ago(st.at) : '' })));
    var b = h('button', { class: 'mbtn', id: 'gl-sync-go', text: 'Save and sync now', onclick: function () {
      b.disabled = true; L.sync.run().then(function (r) { toast(r.pulled ? 'Loaded ' + r.pulled + ' item(s) from your account.' : 'Everything is saved.'); }, function (e) { toast(e.message || 'Could not sync.', true); }).then(function () { b.disabled = false; render(); });
    } });
    box.appendChild(h('div', { style: 'margin-top:12px' }, b));
    return box;
  }

  function connView() {
    var box = h('div');
    box.appendChild(h('div', { class: 'sect', text: 'connection' }));
    box.appendChild(h('p', { class: 'sub', text: 'Grapevine reaches the server through public relay servers on port 443, so it works on school networks. Everything between you and the server is encrypted.' }));
    var out = h('div', { class: 'diag', id: 'gl-diag' });
    if (diagHtml) out.appendChild(diagHtml);
    var b = h('button', { class: 'mbtn', id: 'gl-test', text: 'Test my connection', onclick: function () {
      b.disabled = true; out.textContent = 'Testing...';
      L.diagnose().then(function (r) {
        var frag = document.createElement('div');
        (r.relays || []).forEach(function (x) { frag.appendChild(h('div', null, h('span', { class: x.ok ? 'ok' : 'no', text: x.ok ? 'OK ' : 'BLOCKED ' }), (x.name || x.url) + (x.ok && x.rttMs != null ? ' - ' + Math.round(x.rttMs) + ' ms' : ''))); });
        if (r.summary) frag.appendChild(h('div', { class: 'hint', text: r.summary.text + (r.summary.advice ? ' ' + r.summary.advice : '') }));
        diagHtml = frag; out.textContent = ''; out.appendChild(frag);
      }, function (e) { out.textContent = 'The test could not run: ' + (e && e.message); }).then(function () { b.disabled = false; });
    } });
    box.appendChild(b); box.appendChild(out);
    return box;
  }

  function render() {
    var saved = root;
    mounts.forEach(function (m) { root = m.el; gate = m.gate; renderOne(); });
    root = saved;
  }
  function renderOne() {
    if (!root) return;
    var scroll = root.scrollTop;
    var focus = document.activeElement && document.activeElement.id;
    var val = focus && document.activeElement.value;
    root.textContent = '';
    var body = gate ? (L.me() ? h('div') : signedOut()) : (L.me() ? signedIn() : signedOut());
    root.appendChild(body);
    if (focus) { var el = root.querySelector('#' + focus); if (el) { if (val != null && 'value' in el && el.type !== 'checkbox') el.value = val; try { el.focus(); } catch (e) {} } }
    root.scrollTop = scroll;
  }

  var style;
  function mount(el, opts) {
    if (!style) {
      style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
      ['change', 'friends', 'met', 'sync'].forEach(function (ev) { L.on(ev, function () { if (!busy) render(); }); });
    }
    var r = h('div', { class: 'gl' });
    el.textContent = ''; el.appendChild(r);
    mounts.push({ el: r, gate: !!(opts && opts.gate) });
    render();
    return r;
  }

  window.HGGrapevineUI = { mount: mount, render: render };
})();
})();

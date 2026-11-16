const Vr=()=>{};var Qt={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Nn=function(n){const e=[];let t=0;for(let r=0;r<n.length;r++){let i=n.charCodeAt(r);i<128?e[t++]=i:i<2048?(e[t++]=i>>6|192,e[t++]=i&63|128):(i&64512)===55296&&r+1<n.length&&(n.charCodeAt(r+1)&64512)===56320?(i=65536+((i&1023)<<10)+(n.charCodeAt(++r)&1023),e[t++]=i>>18|240,e[t++]=i>>12&63|128,e[t++]=i>>6&63|128,e[t++]=i&63|128):(e[t++]=i>>12|224,e[t++]=i>>6&63|128,e[t++]=i&63|128)}return e},Sr=function(n){const e=[];let t=0,r=0;for(;t<n.length;){const i=n[t++];if(i<128)e[r++]=String.fromCharCode(i);else if(i>191&&i<224){const s=n[t++];e[r++]=String.fromCharCode((i&31)<<6|s&63)}else if(i>239&&i<365){const s=n[t++],o=n[t++],f=n[t++],m=((i&7)<<18|(s&63)<<12|(o&63)<<6|f&63)-65536;e[r++]=String.fromCharCode(55296+(m>>10)),e[r++]=String.fromCharCode(56320+(m&1023))}else{const s=n[t++],o=n[t++];e[r++]=String.fromCharCode((i&15)<<12|(s&63)<<6|o&63)}}return e.join("")},On={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(n,e){if(!Array.isArray(n))throw Error("encodeByteArray takes an array as a parameter");this.init_();const t=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let i=0;i<n.length;i+=3){const s=n[i],o=i+1<n.length,f=o?n[i+1]:0,m=i+2<n.length,g=m?n[i+2]:0,y=s>>2,w=(s&3)<<4|f>>4;let _=(f&15)<<2|g>>6,T=g&63;m||(T=64,o||(_=64)),r.push(t[y],t[w],t[_],t[T])}return r.join("")},encodeString(n,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(n):this.encodeByteArray(Nn(n),e)},decodeString(n,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(n):Sr(this.decodeStringToByteArray(n,e))},decodeStringToByteArray(n,e){this.init_();const t=e?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let i=0;i<n.length;){const s=t[n.charAt(i++)],f=i<n.length?t[n.charAt(i)]:0;++i;const g=i<n.length?t[n.charAt(i)]:64;++i;const w=i<n.length?t[n.charAt(i)]:64;if(++i,s==null||f==null||g==null||w==null)throw new Pr;const _=s<<2|f>>4;if(r.push(_),g!==64){const T=f<<4&240|g>>2;if(r.push(T),w!==64){const I=g<<6&192|w;r.push(I)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let n=0;n<this.ENCODED_VALS.length;n++)this.byteToCharMap_[n]=this.ENCODED_VALS.charAt(n),this.charToByteMap_[this.byteToCharMap_[n]]=n,this.byteToCharMapWebSafe_[n]=this.ENCODED_VALS_WEBSAFE.charAt(n),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[n]]=n,n>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(n)]=n,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(n)]=n)}}};class Pr extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const Rr=function(n){const e=Nn(n);return On.encodeByteArray(e,!0)},$e=function(n){return Rr(n).replace(/\./g,"")},Cr=function(n){try{return On.decodeString(n,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Dr(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const kr=()=>Dr().__FIREBASE_DEFAULTS__,Nr=()=>{if(typeof process>"u"||typeof Qt>"u")return;const n=Qt.__FIREBASE_DEFAULTS__;if(n)return JSON.parse(n)},Or=()=>{if(typeof document>"u")return;let n;try{n=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const e=n&&Cr(n[1]);return e&&JSON.parse(e)},Pt=()=>{try{return Vr()||kr()||Nr()||Or()}catch(n){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${n}`);return}},Fr=n=>{var e,t;return(t=(e=Pt())===null||e===void 0?void 0:e.emulatorHosts)===null||t===void 0?void 0:t[n]},xr=n=>{const e=Fr(n);if(!e)return;const t=e.lastIndexOf(":");if(t<=0||t+1===e.length)throw new Error(`Invalid host ${e} with no separate hostname and port!`);const r=parseInt(e.substring(t+1),10);return e[0]==="["?[e.substring(1,t-1),r]:[e.substring(0,t),r]},Fn=()=>{var n;return(n=Pt())===null||n===void 0?void 0:n.config},Bo=n=>{var e;return(e=Pt())===null||e===void 0?void 0:e[`_${n}`]};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Mr{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,t)=>{this.resolve=e,this.reject=t})}wrapCallback(e){return(t,r)=>{t?this.reject(t):this.resolve(r),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(t):e(t,r))}}}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Rt(n){try{return(n.startsWith("http://")||n.startsWith("https://")?new URL(n).hostname:n).endsWith(".cloudworkstations.dev")}catch{return!1}}async function Br(n){return(await fetch(n,{credentials:"include"})).ok}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Lr(n,e){if(n.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const t={alg:"none",type:"JWT"},r=e||"demo-project",i=n.iat||0,s=n.sub||n.user_id;if(!s)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const o=Object.assign({iss:`https://securetoken.google.com/${r}`,aud:r,iat:i,exp:i+3600,auth_time:i,sub:s,user_id:s,firebase:{sign_in_provider:"custom",identities:{}}},n);return[$e(JSON.stringify(t)),$e(JSON.stringify(o)),""].join(".")}const ye={};function $r(){const n={prod:[],emulator:[]};for(const e of Object.keys(ye))ye[e]?n.emulator.push(e):n.prod.push(e);return n}function jr(n){let e=document.getElementById(n),t=!1;return e||(e=document.createElement("div"),e.setAttribute("id",n),t=!0),{created:t,element:e}}let Jt=!1;function Ur(n,e){if(typeof window>"u"||typeof document>"u"||!Rt(window.location.host)||ye[n]===e||ye[n]||Jt)return;ye[n]=e;function t(_){return`__firebase__banner__${_}`}const r="__firebase__banner",s=$r().prod.length>0;function o(){const _=document.getElementById(r);_&&_.remove()}function f(_){_.style.display="flex",_.style.background="#7faaf0",_.style.position="fixed",_.style.bottom="5px",_.style.left="5px",_.style.padding=".5em",_.style.borderRadius="5px",_.style.alignItems="center"}function m(_,T){_.setAttribute("width","24"),_.setAttribute("id",T),_.setAttribute("height","24"),_.setAttribute("viewBox","0 0 24 24"),_.setAttribute("fill","none"),_.style.marginLeft="-6px"}function g(){const _=document.createElement("span");return _.style.cursor="pointer",_.style.marginLeft="16px",_.style.fontSize="24px",_.innerHTML=" &times;",_.onclick=()=>{Jt=!0,o()},_}function y(_,T){_.setAttribute("id",T),_.innerText="Learn more",_.href="https://firebase.google.com/docs/studio/preview-apps#preview-backend",_.setAttribute("target","__blank"),_.style.paddingLeft="5px",_.style.textDecoration="underline"}function w(){const _=jr(r),T=t("text"),I=document.getElementById(T)||document.createElement("span"),P=t("learnmore"),V=document.getElementById(P)||document.createElement("a"),ie=t("preprendIcon"),Q=document.getElementById(ie)||document.createElementNS("http://www.w3.org/2000/svg","svg");if(_.created){const J=_.element;f(J),y(V,P);const he=g();m(Q,ie),J.append(Q,I,V,he),document.body.appendChild(J)}s?(I.innerText="Preview backend disconnected.",Q.innerHTML=`<g clip-path="url(#clip0_6013_33858)">
<path d="M4.8 17.6L12 5.6L19.2 17.6H4.8ZM6.91667 16.4H17.0833L12 7.93333L6.91667 16.4ZM12 15.6C12.1667 15.6 12.3056 15.5444 12.4167 15.4333C12.5389 15.3111 12.6 15.1667 12.6 15C12.6 14.8333 12.5389 14.6944 12.4167 14.5833C12.3056 14.4611 12.1667 14.4 12 14.4C11.8333 14.4 11.6889 14.4611 11.5667 14.5833C11.4556 14.6944 11.4 14.8333 11.4 15C11.4 15.1667 11.4556 15.3111 11.5667 15.4333C11.6889 15.5444 11.8333 15.6 12 15.6ZM11.4 13.6H12.6V10.4H11.4V13.6Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6013_33858">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`):(Q.innerHTML=`<g clip-path="url(#clip0_6083_34804)">
<path d="M11.4 15.2H12.6V11.2H11.4V15.2ZM12 10C12.1667 10 12.3056 9.94444 12.4167 9.83333C12.5389 9.71111 12.6 9.56667 12.6 9.4C12.6 9.23333 12.5389 9.09444 12.4167 8.98333C12.3056 8.86111 12.1667 8.8 12 8.8C11.8333 8.8 11.6889 8.86111 11.5667 8.98333C11.4556 9.09444 11.4 9.23333 11.4 9.4C11.4 9.56667 11.4556 9.71111 11.5667 9.83333C11.6889 9.94444 11.8333 10 12 10ZM12 18.4C11.1222 18.4 10.2944 18.2333 9.51667 17.9C8.73889 17.5667 8.05556 17.1111 7.46667 16.5333C6.88889 15.9444 6.43333 15.2611 6.1 14.4833C5.76667 13.7056 5.6 12.8778 5.6 12C5.6 11.1111 5.76667 10.2833 6.1 9.51667C6.43333 8.73889 6.88889 8.06111 7.46667 7.48333C8.05556 6.89444 8.73889 6.43333 9.51667 6.1C10.2944 5.76667 11.1222 5.6 12 5.6C12.8889 5.6 13.7167 5.76667 14.4833 6.1C15.2611 6.43333 15.9389 6.89444 16.5167 7.48333C17.1056 8.06111 17.5667 8.73889 17.9 9.51667C18.2333 10.2833 18.4 11.1111 18.4 12C18.4 12.8778 18.2333 13.7056 17.9 14.4833C17.5667 15.2611 17.1056 15.9444 16.5167 16.5333C15.9389 17.1111 15.2611 17.5667 14.4833 17.9C13.7167 18.2333 12.8889 18.4 12 18.4ZM12 17.2C13.4444 17.2 14.6722 16.6944 15.6833 15.6833C16.6944 14.6722 17.2 13.4444 17.2 12C17.2 10.5556 16.6944 9.32778 15.6833 8.31667C14.6722 7.30555 13.4444 6.8 12 6.8C10.5556 6.8 9.32778 7.30555 8.31667 8.31667C7.30556 9.32778 6.8 10.5556 6.8 12C6.8 13.4444 7.30556 14.6722 8.31667 15.6833C9.32778 16.6944 10.5556 17.2 12 17.2Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6083_34804">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`,I.innerText="Preview backend running in this workspace."),I.setAttribute("id",T)}document.readyState==="loading"?window.addEventListener("DOMContentLoaded",w):w()}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function xn(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function Lo(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(xn())}function $o(){return typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"}function jo(){const n=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof n=="object"&&n.id!==void 0}function Uo(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function zo(){const n=xn();return n.indexOf("MSIE ")>=0||n.indexOf("Trident/")>=0}function zr(){try{return typeof indexedDB=="object"}catch{return!1}}function qr(){return new Promise((n,e)=>{try{let t=!0;const r="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),t||self.indexedDB.deleteDatabase(r),n(!0)},i.onupgradeneeded=()=>{t=!1},i.onerror=()=>{var s;e(((s=i.error)===null||s===void 0?void 0:s.message)||"")}}catch(t){e(t)}})}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Hr="FirebaseError";class ge extends Error{constructor(e,t,r){super(t),this.code=e,this.customData=r,this.name=Hr,Object.setPrototypeOf(this,ge.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,Mn.prototype.create)}}class Mn{constructor(e,t,r){this.service=e,this.serviceName=t,this.errors=r}create(e,...t){const r=t[0]||{},i=`${this.service}/${e}`,s=this.errors[e],o=s?Wr(s,r):"Error",f=`${this.serviceName}: ${o} (${i}).`;return new ge(i,f,r)}}function Wr(n,e){return n.replace(Gr,(t,r)=>{const i=e[r];return i!=null?String(i):`<${r}?>`})}const Gr=/\{\$([^}]+)}/g;function qo(n){for(const e in n)if(Object.prototype.hasOwnProperty.call(n,e))return!1;return!0}function je(n,e){if(n===e)return!0;const t=Object.keys(n),r=Object.keys(e);for(const i of t){if(!r.includes(i))return!1;const s=n[i],o=e[i];if(Yt(s)&&Yt(o)){if(!je(s,o))return!1}else if(s!==o)return!1}for(const i of r)if(!t.includes(i))return!1;return!0}function Yt(n){return n!==null&&typeof n=="object"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ho(n){const e=[];for(const[t,r]of Object.entries(n))Array.isArray(r)?r.forEach(i=>{e.push(encodeURIComponent(t)+"="+encodeURIComponent(i))}):e.push(encodeURIComponent(t)+"="+encodeURIComponent(r));return e.length?"&"+e.join("&"):""}function Wo(n){const e={};return n.replace(/^\?/,"").split("&").forEach(r=>{if(r){const[i,s]=r.split("=");e[decodeURIComponent(i)]=decodeURIComponent(s)}}),e}function Go(n){const e=n.indexOf("?");if(!e)return"";const t=n.indexOf("#",e);return n.substring(e,t>0?t:void 0)}function Ko(n,e){const t=new Kr(n,e);return t.subscribe.bind(t)}class Kr{constructor(e,t){this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=Promise.resolve(),this.finalized=!1,this.onNoObservers=t,this.task.then(()=>{e(this)}).catch(r=>{this.error(r)})}next(e){this.forEachObserver(t=>{t.next(e)})}error(e){this.forEachObserver(t=>{t.error(e)}),this.close(e)}complete(){this.forEachObserver(e=>{e.complete()}),this.close()}subscribe(e,t,r){let i;if(e===void 0&&t===void 0&&r===void 0)throw new Error("Missing Observer.");Qr(e,["next","error","complete"])?i=e:i={next:e,error:t,complete:r},i.next===void 0&&(i.next=at),i.error===void 0&&(i.error=at),i.complete===void 0&&(i.complete=at);const s=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(()=>{try{this.finalError?i.error(this.finalError):i.complete()}catch{}}),this.observers.push(i),s}unsubscribeOne(e){this.observers===void 0||this.observers[e]===void 0||(delete this.observers[e],this.observerCount-=1,this.observerCount===0&&this.onNoObservers!==void 0&&this.onNoObservers(this))}forEachObserver(e){if(!this.finalized)for(let t=0;t<this.observers.length;t++)this.sendOne(t,e)}sendOne(e,t){this.task.then(()=>{if(this.observers!==void 0&&this.observers[e]!==void 0)try{t(this.observers[e])}catch(r){typeof console<"u"&&console.error&&console.error(r)}})}close(e){this.finalized||(this.finalized=!0,e!==void 0&&(this.finalError=e),this.task.then(()=>{this.observers=void 0,this.onNoObservers=void 0}))}}function Qr(n,e){if(typeof n!="object"||n===null)return!1;for(const t of e)if(t in n&&typeof n[t]=="function")return!0;return!1}function at(){}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Jr=1e3,Yr=2,Xr=4*60*60*1e3,Zr=.5;function Qo(n,e=Jr,t=Yr){const r=e*Math.pow(t,n),i=Math.round(Zr*r*(Math.random()-.5)*2);return Math.min(Xr,r+i)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function K(n){return n&&n._delegate?n._delegate:n}class Ie{constructor(e,t,r){this.name=e,this.instanceFactory=t,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const oe="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ei{constructor(e,t){this.name=e,this.container=t,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){const t=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(t)){const r=new Mr;if(this.instancesDeferred.set(t,r),this.isInitialized(t)||this.shouldAutoInitialize())try{const i=this.getOrInitializeService({instanceIdentifier:t});i&&r.resolve(i)}catch{}}return this.instancesDeferred.get(t).promise}getImmediate(e){var t;const r=this.normalizeInstanceIdentifier(e?.identifier),i=(t=e?.optional)!==null&&t!==void 0?t:!1;if(this.isInitialized(r)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:r})}catch(s){if(i)return null;throw s}else{if(i)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(ni(e))try{this.getOrInitializeService({instanceIdentifier:oe})}catch{}for(const[t,r]of this.instancesDeferred.entries()){const i=this.normalizeInstanceIdentifier(t);try{const s=this.getOrInitializeService({instanceIdentifier:i});r.resolve(s)}catch{}}}}clearInstance(e=oe){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){const e=Array.from(this.instances.values());await Promise.all([...e.filter(t=>"INTERNAL"in t).map(t=>t.INTERNAL.delete()),...e.filter(t=>"_delete"in t).map(t=>t._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=oe){return this.instances.has(e)}getOptions(e=oe){return this.instancesOptions.get(e)||{}}initialize(e={}){const{options:t={}}=e,r=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const i=this.getOrInitializeService({instanceIdentifier:r,options:t});for(const[s,o]of this.instancesDeferred.entries()){const f=this.normalizeInstanceIdentifier(s);r===f&&o.resolve(i)}return i}onInit(e,t){var r;const i=this.normalizeInstanceIdentifier(t),s=(r=this.onInitCallbacks.get(i))!==null&&r!==void 0?r:new Set;s.add(e),this.onInitCallbacks.set(i,s);const o=this.instances.get(i);return o&&e(o,i),()=>{s.delete(e)}}invokeOnInitCallbacks(e,t){const r=this.onInitCallbacks.get(t);if(r)for(const i of r)try{i(e,t)}catch{}}getOrInitializeService({instanceIdentifier:e,options:t={}}){let r=this.instances.get(e);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:ti(e),options:t}),this.instances.set(e,r),this.instancesOptions.set(e,t),this.invokeOnInitCallbacks(r,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,r)}catch{}return r||null}normalizeInstanceIdentifier(e=oe){return this.component?this.component.multipleInstances?e:oe:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function ti(n){return n===oe?void 0:n}function ni(n){return n.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ri{constructor(e){this.name=e,this.providers=new Map}addComponent(e){const t=this.getProvider(e.name);if(t.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);t.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);const t=new ei(e,this);return this.providers.set(e,t),t}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var A;(function(n){n[n.DEBUG=0]="DEBUG",n[n.VERBOSE=1]="VERBOSE",n[n.INFO=2]="INFO",n[n.WARN=3]="WARN",n[n.ERROR=4]="ERROR",n[n.SILENT=5]="SILENT"})(A||(A={}));const ii={debug:A.DEBUG,verbose:A.VERBOSE,info:A.INFO,warn:A.WARN,error:A.ERROR,silent:A.SILENT},si=A.INFO,oi={[A.DEBUG]:"log",[A.VERBOSE]:"log",[A.INFO]:"info",[A.WARN]:"warn",[A.ERROR]:"error"},ai=(n,e,...t)=>{if(e<n.logLevel)return;const r=new Date().toISOString(),i=oi[e];if(i)console[i](`[${r}]  ${n.name}:`,...t);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)};class Bn{constructor(e){this.name=e,this._logLevel=si,this._logHandler=ai,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in A))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?ii[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,A.DEBUG,...e),this._logHandler(this,A.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,A.VERBOSE,...e),this._logHandler(this,A.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,A.INFO,...e),this._logHandler(this,A.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,A.WARN,...e),this._logHandler(this,A.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,A.ERROR,...e),this._logHandler(this,A.ERROR,...e)}}const ui=(n,e)=>e.some(t=>n instanceof t);let Xt,Zt;function li(){return Xt||(Xt=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function ci(){return Zt||(Zt=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const Ln=new WeakMap,mt=new WeakMap,$n=new WeakMap,ut=new WeakMap,Ct=new WeakMap;function hi(n){const e=new Promise((t,r)=>{const i=()=>{n.removeEventListener("success",s),n.removeEventListener("error",o)},s=()=>{t(Z(n.result)),i()},o=()=>{r(n.error),i()};n.addEventListener("success",s),n.addEventListener("error",o)});return e.then(t=>{t instanceof IDBCursor&&Ln.set(t,n)}).catch(()=>{}),Ct.set(e,n),e}function di(n){if(mt.has(n))return;const e=new Promise((t,r)=>{const i=()=>{n.removeEventListener("complete",s),n.removeEventListener("error",o),n.removeEventListener("abort",o)},s=()=>{t(),i()},o=()=>{r(n.error||new DOMException("AbortError","AbortError")),i()};n.addEventListener("complete",s),n.addEventListener("error",o),n.addEventListener("abort",o)});mt.set(n,e)}let gt={get(n,e,t){if(n instanceof IDBTransaction){if(e==="done")return mt.get(n);if(e==="objectStoreNames")return n.objectStoreNames||$n.get(n);if(e==="store")return t.objectStoreNames[1]?void 0:t.objectStore(t.objectStoreNames[0])}return Z(n[e])},set(n,e,t){return n[e]=t,!0},has(n,e){return n instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in n}};function fi(n){gt=n(gt)}function pi(n){return n===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...t){const r=n.call(lt(this),e,...t);return $n.set(r,e.sort?e.sort():[e]),Z(r)}:ci().includes(n)?function(...e){return n.apply(lt(this),e),Z(Ln.get(this))}:function(...e){return Z(n.apply(lt(this),e))}}function mi(n){return typeof n=="function"?pi(n):(n instanceof IDBTransaction&&di(n),ui(n,li())?new Proxy(n,gt):n)}function Z(n){if(n instanceof IDBRequest)return hi(n);if(ut.has(n))return ut.get(n);const e=mi(n);return e!==n&&(ut.set(n,e),Ct.set(e,n)),e}const lt=n=>Ct.get(n);function gi(n,e,{blocked:t,upgrade:r,blocking:i,terminated:s}={}){const o=indexedDB.open(n,e),f=Z(o);return r&&o.addEventListener("upgradeneeded",m=>{r(Z(o.result),m.oldVersion,m.newVersion,Z(o.transaction),m)}),t&&o.addEventListener("blocked",m=>t(m.oldVersion,m.newVersion,m)),f.then(m=>{s&&m.addEventListener("close",()=>s()),i&&m.addEventListener("versionchange",g=>i(g.oldVersion,g.newVersion,g))}).catch(()=>{}),f}const _i=["get","getKey","getAll","getAllKeys","count"],yi=["put","add","delete","clear"],ct=new Map;function en(n,e){if(!(n instanceof IDBDatabase&&!(e in n)&&typeof e=="string"))return;if(ct.get(e))return ct.get(e);const t=e.replace(/FromIndex$/,""),r=e!==t,i=yi.includes(t);if(!(t in(r?IDBIndex:IDBObjectStore).prototype)||!(i||_i.includes(t)))return;const s=async function(o,...f){const m=this.transaction(o,i?"readwrite":"readonly");let g=m.store;return r&&(g=g.index(f.shift())),(await Promise.all([g[t](...f),i&&m.done]))[0]};return ct.set(e,s),s}fi(n=>({...n,get:(e,t,r)=>en(e,t)||n.get(e,t,r),has:(e,t)=>!!en(e,t)||n.has(e,t)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vi{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(t=>{if(wi(t)){const r=t.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(t=>t).join(" ")}}function wi(n){const e=n.getComponent();return e?.type==="VERSION"}const _t="@firebase/app",tn="0.13.2";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Y=new Bn("@firebase/app"),Ei="@firebase/app-compat",bi="@firebase/analytics-compat",Ii="@firebase/analytics",Ti="@firebase/app-check-compat",Ai="@firebase/app-check",Vi="@firebase/auth",Si="@firebase/auth-compat",Pi="@firebase/database",Ri="@firebase/data-connect",Ci="@firebase/database-compat",Di="@firebase/functions",ki="@firebase/functions-compat",Ni="@firebase/installations",Oi="@firebase/installations-compat",Fi="@firebase/messaging",xi="@firebase/messaging-compat",Mi="@firebase/performance",Bi="@firebase/performance-compat",Li="@firebase/remote-config",$i="@firebase/remote-config-compat",ji="@firebase/storage",Ui="@firebase/storage-compat",zi="@firebase/firestore",qi="@firebase/ai",Hi="@firebase/firestore-compat",Wi="firebase",Gi="11.10.0";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yt="[DEFAULT]",Ki={[_t]:"fire-core",[Ei]:"fire-core-compat",[Ii]:"fire-analytics",[bi]:"fire-analytics-compat",[Ai]:"fire-app-check",[Ti]:"fire-app-check-compat",[Vi]:"fire-auth",[Si]:"fire-auth-compat",[Pi]:"fire-rtdb",[Ri]:"fire-data-connect",[Ci]:"fire-rtdb-compat",[Di]:"fire-fn",[ki]:"fire-fn-compat",[Ni]:"fire-iid",[Oi]:"fire-iid-compat",[Fi]:"fire-fcm",[xi]:"fire-fcm-compat",[Mi]:"fire-perf",[Bi]:"fire-perf-compat",[Li]:"fire-rc",[$i]:"fire-rc-compat",[ji]:"fire-gcs",[Ui]:"fire-gcs-compat",[zi]:"fire-fst",[Hi]:"fire-fst-compat",[qi]:"fire-vertex","fire-js":"fire-js",[Wi]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ue=new Map,Qi=new Map,vt=new Map;function nn(n,e){try{n.container.addComponent(e)}catch(t){Y.debug(`Component ${e.name} failed to register with FirebaseApp ${n.name}`,t)}}function ze(n){const e=n.name;if(vt.has(e))return Y.debug(`There were multiple attempts to register component ${e}.`),!1;vt.set(e,n);for(const t of Ue.values())nn(t,n);for(const t of Qi.values())nn(t,n);return!0}function Ji(n,e){const t=n.container.getProvider("heartbeat").getImmediate({optional:!0});return t&&t.triggerHeartbeat(),n.container.getProvider(e)}function Yi(n){return n==null?!1:n.settings!==void 0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xi={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},ee=new Mn("app","Firebase",Xi);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zi{constructor(e,t,r){this._isDeleted=!1,this._options=Object.assign({},e),this._config=Object.assign({},t),this._name=t.name,this._automaticDataCollectionEnabled=t.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new Ie("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw ee.create("app-deleted",{appName:this._name})}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const es=Gi;function ts(n,e={}){let t=n;typeof e!="object"&&(e={name:e});const r=Object.assign({name:yt,automaticDataCollectionEnabled:!0},e),i=r.name;if(typeof i!="string"||!i)throw ee.create("bad-app-name",{appName:String(i)});if(t||(t=Fn()),!t)throw ee.create("no-options");const s=Ue.get(i);if(s){if(je(t,s.options)&&je(r,s.config))return s;throw ee.create("duplicate-app",{appName:i})}const o=new ri(i);for(const m of vt.values())o.addComponent(m);const f=new Zi(t,r,o);return Ue.set(i,f),f}function ns(n=yt){const e=Ue.get(n);if(!e&&n===yt&&Fn())return ts();if(!e)throw ee.create("no-app",{appName:n});return e}function pe(n,e,t){var r;let i=(r=Ki[n])!==null&&r!==void 0?r:n;t&&(i+=`-${t}`);const s=i.match(/\s|\//),o=e.match(/\s|\//);if(s||o){const f=[`Unable to register library "${i}" with version "${e}":`];s&&f.push(`library name "${i}" contains illegal characters (whitespace or "/")`),s&&o&&f.push("and"),o&&f.push(`version name "${e}" contains illegal characters (whitespace or "/")`),Y.warn(f.join(" "));return}ze(new Ie(`${i}-version`,()=>({library:i,version:e}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const rs="firebase-heartbeat-database",is=1,Te="firebase-heartbeat-store";let ht=null;function jn(){return ht||(ht=gi(rs,is,{upgrade:(n,e)=>{switch(e){case 0:try{n.createObjectStore(Te)}catch(t){console.warn(t)}}}}).catch(n=>{throw ee.create("idb-open",{originalErrorMessage:n.message})})),ht}async function ss(n){try{const t=(await jn()).transaction(Te),r=await t.objectStore(Te).get(Un(n));return await t.done,r}catch(e){if(e instanceof ge)Y.warn(e.message);else{const t=ee.create("idb-get",{originalErrorMessage:e?.message});Y.warn(t.message)}}}async function rn(n,e){try{const r=(await jn()).transaction(Te,"readwrite");await r.objectStore(Te).put(e,Un(n)),await r.done}catch(t){if(t instanceof ge)Y.warn(t.message);else{const r=ee.create("idb-set",{originalErrorMessage:t?.message});Y.warn(r.message)}}}function Un(n){return`${n.name}!${n.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const os=1024,as=30;class us{constructor(e){this.container=e,this._heartbeatsCache=null;const t=this.container.getProvider("app").getImmediate();this._storage=new cs(t),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var e,t;try{const i=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),s=sn();if(((e=this._heartbeatsCache)===null||e===void 0?void 0:e.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((t=this._heartbeatsCache)===null||t===void 0?void 0:t.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===s||this._heartbeatsCache.heartbeats.some(o=>o.date===s))return;if(this._heartbeatsCache.heartbeats.push({date:s,agent:i}),this._heartbeatsCache.heartbeats.length>as){const o=hs(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(o,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(r){Y.warn(r)}}async getHeartbeatsHeader(){var e;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((e=this._heartbeatsCache)===null||e===void 0?void 0:e.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const t=sn(),{heartbeatsToSend:r,unsentEntries:i}=ls(this._heartbeatsCache.heartbeats),s=$e(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=t,i.length>0?(this._heartbeatsCache.heartbeats=i,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),s}catch(t){return Y.warn(t),""}}}function sn(){return new Date().toISOString().substring(0,10)}function ls(n,e=os){const t=[];let r=n.slice();for(const i of n){const s=t.find(o=>o.agent===i.agent);if(s){if(s.dates.push(i.date),on(t)>e){s.dates.pop();break}}else if(t.push({agent:i.agent,dates:[i.date]}),on(t)>e){t.pop();break}r=r.slice(1)}return{heartbeatsToSend:t,unsentEntries:r}}class cs{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return zr()?qr().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const t=await ss(this.app);return t?.heartbeats?t:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){var t;if(await this._canUseIndexedDBPromise){const i=await this.read();return rn(this.app,{lastSentHeartbeatDate:(t=e.lastSentHeartbeatDate)!==null&&t!==void 0?t:i.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){var t;if(await this._canUseIndexedDBPromise){const i=await this.read();return rn(this.app,{lastSentHeartbeatDate:(t=e.lastSentHeartbeatDate)!==null&&t!==void 0?t:i.lastSentHeartbeatDate,heartbeats:[...i.heartbeats,...e.heartbeats]})}else return}}function on(n){return $e(JSON.stringify({version:2,heartbeats:n})).length}function hs(n){if(n.length===0)return-1;let e=0,t=n[0].date;for(let r=1;r<n.length;r++)n[r].date<t&&(t=n[r].date,e=r);return e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ds(n){ze(new Ie("platform-logger",e=>new vi(e),"PRIVATE")),ze(new Ie("heartbeat",e=>new us(e),"PRIVATE")),pe(_t,tn,n),pe(_t,tn,"esm2017"),pe("fire-js","")}ds("");var an=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var zn;(function(){var n;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function e(d,a){function l(){}l.prototype=a.prototype,d.D=a.prototype,d.prototype=new l,d.prototype.constructor=d,d.C=function(c,h,p){for(var u=Array(arguments.length-2),se=2;se<arguments.length;se++)u[se-2]=arguments[se];return a.prototype[h].apply(c,u)}}function t(){this.blockSize=-1}function r(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.B=Array(this.blockSize),this.o=this.h=0,this.s()}e(r,t),r.prototype.s=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function i(d,a,l){l||(l=0);var c=Array(16);if(typeof a=="string")for(var h=0;16>h;++h)c[h]=a.charCodeAt(l++)|a.charCodeAt(l++)<<8|a.charCodeAt(l++)<<16|a.charCodeAt(l++)<<24;else for(h=0;16>h;++h)c[h]=a[l++]|a[l++]<<8|a[l++]<<16|a[l++]<<24;a=d.g[0],l=d.g[1],h=d.g[2];var p=d.g[3],u=a+(p^l&(h^p))+c[0]+3614090360&4294967295;a=l+(u<<7&4294967295|u>>>25),u=p+(h^a&(l^h))+c[1]+3905402710&4294967295,p=a+(u<<12&4294967295|u>>>20),u=h+(l^p&(a^l))+c[2]+606105819&4294967295,h=p+(u<<17&4294967295|u>>>15),u=l+(a^h&(p^a))+c[3]+3250441966&4294967295,l=h+(u<<22&4294967295|u>>>10),u=a+(p^l&(h^p))+c[4]+4118548399&4294967295,a=l+(u<<7&4294967295|u>>>25),u=p+(h^a&(l^h))+c[5]+1200080426&4294967295,p=a+(u<<12&4294967295|u>>>20),u=h+(l^p&(a^l))+c[6]+2821735955&4294967295,h=p+(u<<17&4294967295|u>>>15),u=l+(a^h&(p^a))+c[7]+4249261313&4294967295,l=h+(u<<22&4294967295|u>>>10),u=a+(p^l&(h^p))+c[8]+1770035416&4294967295,a=l+(u<<7&4294967295|u>>>25),u=p+(h^a&(l^h))+c[9]+2336552879&4294967295,p=a+(u<<12&4294967295|u>>>20),u=h+(l^p&(a^l))+c[10]+4294925233&4294967295,h=p+(u<<17&4294967295|u>>>15),u=l+(a^h&(p^a))+c[11]+2304563134&4294967295,l=h+(u<<22&4294967295|u>>>10),u=a+(p^l&(h^p))+c[12]+1804603682&4294967295,a=l+(u<<7&4294967295|u>>>25),u=p+(h^a&(l^h))+c[13]+4254626195&4294967295,p=a+(u<<12&4294967295|u>>>20),u=h+(l^p&(a^l))+c[14]+2792965006&4294967295,h=p+(u<<17&4294967295|u>>>15),u=l+(a^h&(p^a))+c[15]+1236535329&4294967295,l=h+(u<<22&4294967295|u>>>10),u=a+(h^p&(l^h))+c[1]+4129170786&4294967295,a=l+(u<<5&4294967295|u>>>27),u=p+(l^h&(a^l))+c[6]+3225465664&4294967295,p=a+(u<<9&4294967295|u>>>23),u=h+(a^l&(p^a))+c[11]+643717713&4294967295,h=p+(u<<14&4294967295|u>>>18),u=l+(p^a&(h^p))+c[0]+3921069994&4294967295,l=h+(u<<20&4294967295|u>>>12),u=a+(h^p&(l^h))+c[5]+3593408605&4294967295,a=l+(u<<5&4294967295|u>>>27),u=p+(l^h&(a^l))+c[10]+38016083&4294967295,p=a+(u<<9&4294967295|u>>>23),u=h+(a^l&(p^a))+c[15]+3634488961&4294967295,h=p+(u<<14&4294967295|u>>>18),u=l+(p^a&(h^p))+c[4]+3889429448&4294967295,l=h+(u<<20&4294967295|u>>>12),u=a+(h^p&(l^h))+c[9]+568446438&4294967295,a=l+(u<<5&4294967295|u>>>27),u=p+(l^h&(a^l))+c[14]+3275163606&4294967295,p=a+(u<<9&4294967295|u>>>23),u=h+(a^l&(p^a))+c[3]+4107603335&4294967295,h=p+(u<<14&4294967295|u>>>18),u=l+(p^a&(h^p))+c[8]+1163531501&4294967295,l=h+(u<<20&4294967295|u>>>12),u=a+(h^p&(l^h))+c[13]+2850285829&4294967295,a=l+(u<<5&4294967295|u>>>27),u=p+(l^h&(a^l))+c[2]+4243563512&4294967295,p=a+(u<<9&4294967295|u>>>23),u=h+(a^l&(p^a))+c[7]+1735328473&4294967295,h=p+(u<<14&4294967295|u>>>18),u=l+(p^a&(h^p))+c[12]+2368359562&4294967295,l=h+(u<<20&4294967295|u>>>12),u=a+(l^h^p)+c[5]+4294588738&4294967295,a=l+(u<<4&4294967295|u>>>28),u=p+(a^l^h)+c[8]+2272392833&4294967295,p=a+(u<<11&4294967295|u>>>21),u=h+(p^a^l)+c[11]+1839030562&4294967295,h=p+(u<<16&4294967295|u>>>16),u=l+(h^p^a)+c[14]+4259657740&4294967295,l=h+(u<<23&4294967295|u>>>9),u=a+(l^h^p)+c[1]+2763975236&4294967295,a=l+(u<<4&4294967295|u>>>28),u=p+(a^l^h)+c[4]+1272893353&4294967295,p=a+(u<<11&4294967295|u>>>21),u=h+(p^a^l)+c[7]+4139469664&4294967295,h=p+(u<<16&4294967295|u>>>16),u=l+(h^p^a)+c[10]+3200236656&4294967295,l=h+(u<<23&4294967295|u>>>9),u=a+(l^h^p)+c[13]+681279174&4294967295,a=l+(u<<4&4294967295|u>>>28),u=p+(a^l^h)+c[0]+3936430074&4294967295,p=a+(u<<11&4294967295|u>>>21),u=h+(p^a^l)+c[3]+3572445317&4294967295,h=p+(u<<16&4294967295|u>>>16),u=l+(h^p^a)+c[6]+76029189&4294967295,l=h+(u<<23&4294967295|u>>>9),u=a+(l^h^p)+c[9]+3654602809&4294967295,a=l+(u<<4&4294967295|u>>>28),u=p+(a^l^h)+c[12]+3873151461&4294967295,p=a+(u<<11&4294967295|u>>>21),u=h+(p^a^l)+c[15]+530742520&4294967295,h=p+(u<<16&4294967295|u>>>16),u=l+(h^p^a)+c[2]+3299628645&4294967295,l=h+(u<<23&4294967295|u>>>9),u=a+(h^(l|~p))+c[0]+4096336452&4294967295,a=l+(u<<6&4294967295|u>>>26),u=p+(l^(a|~h))+c[7]+1126891415&4294967295,p=a+(u<<10&4294967295|u>>>22),u=h+(a^(p|~l))+c[14]+2878612391&4294967295,h=p+(u<<15&4294967295|u>>>17),u=l+(p^(h|~a))+c[5]+4237533241&4294967295,l=h+(u<<21&4294967295|u>>>11),u=a+(h^(l|~p))+c[12]+1700485571&4294967295,a=l+(u<<6&4294967295|u>>>26),u=p+(l^(a|~h))+c[3]+2399980690&4294967295,p=a+(u<<10&4294967295|u>>>22),u=h+(a^(p|~l))+c[10]+4293915773&4294967295,h=p+(u<<15&4294967295|u>>>17),u=l+(p^(h|~a))+c[1]+2240044497&4294967295,l=h+(u<<21&4294967295|u>>>11),u=a+(h^(l|~p))+c[8]+1873313359&4294967295,a=l+(u<<6&4294967295|u>>>26),u=p+(l^(a|~h))+c[15]+4264355552&4294967295,p=a+(u<<10&4294967295|u>>>22),u=h+(a^(p|~l))+c[6]+2734768916&4294967295,h=p+(u<<15&4294967295|u>>>17),u=l+(p^(h|~a))+c[13]+1309151649&4294967295,l=h+(u<<21&4294967295|u>>>11),u=a+(h^(l|~p))+c[4]+4149444226&4294967295,a=l+(u<<6&4294967295|u>>>26),u=p+(l^(a|~h))+c[11]+3174756917&4294967295,p=a+(u<<10&4294967295|u>>>22),u=h+(a^(p|~l))+c[2]+718787259&4294967295,h=p+(u<<15&4294967295|u>>>17),u=l+(p^(h|~a))+c[9]+3951481745&4294967295,d.g[0]=d.g[0]+a&4294967295,d.g[1]=d.g[1]+(h+(u<<21&4294967295|u>>>11))&4294967295,d.g[2]=d.g[2]+h&4294967295,d.g[3]=d.g[3]+p&4294967295}r.prototype.u=function(d,a){a===void 0&&(a=d.length);for(var l=a-this.blockSize,c=this.B,h=this.h,p=0;p<a;){if(h==0)for(;p<=l;)i(this,d,p),p+=this.blockSize;if(typeof d=="string"){for(;p<a;)if(c[h++]=d.charCodeAt(p++),h==this.blockSize){i(this,c),h=0;break}}else for(;p<a;)if(c[h++]=d[p++],h==this.blockSize){i(this,c),h=0;break}}this.h=h,this.o+=a},r.prototype.v=function(){var d=Array((56>this.h?this.blockSize:2*this.blockSize)-this.h);d[0]=128;for(var a=1;a<d.length-8;++a)d[a]=0;var l=8*this.o;for(a=d.length-8;a<d.length;++a)d[a]=l&255,l/=256;for(this.u(d),d=Array(16),a=l=0;4>a;++a)for(var c=0;32>c;c+=8)d[l++]=this.g[a]>>>c&255;return d};function s(d,a){var l=f;return Object.prototype.hasOwnProperty.call(l,d)?l[d]:l[d]=a(d)}function o(d,a){this.h=a;for(var l=[],c=!0,h=d.length-1;0<=h;h--){var p=d[h]|0;c&&p==a||(l[h]=p,c=!1)}this.g=l}var f={};function m(d){return-128<=d&&128>d?s(d,function(a){return new o([a|0],0>a?-1:0)}):new o([d|0],0>d?-1:0)}function g(d){if(isNaN(d)||!isFinite(d))return w;if(0>d)return V(g(-d));for(var a=[],l=1,c=0;d>=l;c++)a[c]=d/l|0,l*=4294967296;return new o(a,0)}function y(d,a){if(d.length==0)throw Error("number format error: empty string");if(a=a||10,2>a||36<a)throw Error("radix out of range: "+a);if(d.charAt(0)=="-")return V(y(d.substring(1),a));if(0<=d.indexOf("-"))throw Error('number format error: interior "-" character');for(var l=g(Math.pow(a,8)),c=w,h=0;h<d.length;h+=8){var p=Math.min(8,d.length-h),u=parseInt(d.substring(h,h+p),a);8>p?(p=g(Math.pow(a,p)),c=c.j(p).add(g(u))):(c=c.j(l),c=c.add(g(u)))}return c}var w=m(0),_=m(1),T=m(16777216);n=o.prototype,n.m=function(){if(P(this))return-V(this).m();for(var d=0,a=1,l=0;l<this.g.length;l++){var c=this.i(l);d+=(0<=c?c:4294967296+c)*a,a*=4294967296}return d},n.toString=function(d){if(d=d||10,2>d||36<d)throw Error("radix out of range: "+d);if(I(this))return"0";if(P(this))return"-"+V(this).toString(d);for(var a=g(Math.pow(d,6)),l=this,c="";;){var h=he(l,a).g;l=ie(l,h.j(a));var p=((0<l.g.length?l.g[0]:l.h)>>>0).toString(d);if(l=h,I(l))return p+c;for(;6>p.length;)p="0"+p;c=p+c}},n.i=function(d){return 0>d?0:d<this.g.length?this.g[d]:this.h};function I(d){if(d.h!=0)return!1;for(var a=0;a<d.g.length;a++)if(d.g[a]!=0)return!1;return!0}function P(d){return d.h==-1}n.l=function(d){return d=ie(this,d),P(d)?-1:I(d)?0:1};function V(d){for(var a=d.g.length,l=[],c=0;c<a;c++)l[c]=~d.g[c];return new o(l,~d.h).add(_)}n.abs=function(){return P(this)?V(this):this},n.add=function(d){for(var a=Math.max(this.g.length,d.g.length),l=[],c=0,h=0;h<=a;h++){var p=c+(this.i(h)&65535)+(d.i(h)&65535),u=(p>>>16)+(this.i(h)>>>16)+(d.i(h)>>>16);c=u>>>16,p&=65535,u&=65535,l[h]=u<<16|p}return new o(l,l[l.length-1]&-2147483648?-1:0)};function ie(d,a){return d.add(V(a))}n.j=function(d){if(I(this)||I(d))return w;if(P(this))return P(d)?V(this).j(V(d)):V(V(this).j(d));if(P(d))return V(this.j(V(d)));if(0>this.l(T)&&0>d.l(T))return g(this.m()*d.m());for(var a=this.g.length+d.g.length,l=[],c=0;c<2*a;c++)l[c]=0;for(c=0;c<this.g.length;c++)for(var h=0;h<d.g.length;h++){var p=this.i(c)>>>16,u=this.i(c)&65535,se=d.i(h)>>>16,Kt=d.i(h)&65535;l[2*c+2*h]+=u*Kt,Q(l,2*c+2*h),l[2*c+2*h+1]+=p*Kt,Q(l,2*c+2*h+1),l[2*c+2*h+1]+=u*se,Q(l,2*c+2*h+1),l[2*c+2*h+2]+=p*se,Q(l,2*c+2*h+2)}for(c=0;c<a;c++)l[c]=l[2*c+1]<<16|l[2*c];for(c=a;c<2*a;c++)l[c]=0;return new o(l,0)};function Q(d,a){for(;(d[a]&65535)!=d[a];)d[a+1]+=d[a]>>>16,d[a]&=65535,a++}function J(d,a){this.g=d,this.h=a}function he(d,a){if(I(a))throw Error("division by zero");if(I(d))return new J(w,w);if(P(d))return a=he(V(d),a),new J(V(a.g),V(a.h));if(P(a))return a=he(d,V(a)),new J(V(a.g),a.h);if(30<d.g.length){if(P(d)||P(a))throw Error("slowDivide_ only works with positive integers.");for(var l=_,c=a;0>=c.l(d);)l=Gt(l),c=Gt(c);var h=de(l,1),p=de(c,1);for(c=de(c,2),l=de(l,2);!I(c);){var u=p.add(c);0>=u.l(d)&&(h=h.add(l),p=u),c=de(c,1),l=de(l,1)}return a=ie(d,h.j(a)),new J(h,a)}for(h=w;0<=d.l(a);){for(l=Math.max(1,Math.floor(d.m()/a.m())),c=Math.ceil(Math.log(l)/Math.LN2),c=48>=c?1:Math.pow(2,c-48),p=g(l),u=p.j(a);P(u)||0<u.l(d);)l-=c,p=g(l),u=p.j(a);I(p)&&(p=_),h=h.add(p),d=ie(d,u)}return new J(h,d)}n.A=function(d){return he(this,d).h},n.and=function(d){for(var a=Math.max(this.g.length,d.g.length),l=[],c=0;c<a;c++)l[c]=this.i(c)&d.i(c);return new o(l,this.h&d.h)},n.or=function(d){for(var a=Math.max(this.g.length,d.g.length),l=[],c=0;c<a;c++)l[c]=this.i(c)|d.i(c);return new o(l,this.h|d.h)},n.xor=function(d){for(var a=Math.max(this.g.length,d.g.length),l=[],c=0;c<a;c++)l[c]=this.i(c)^d.i(c);return new o(l,this.h^d.h)};function Gt(d){for(var a=d.g.length+1,l=[],c=0;c<a;c++)l[c]=d.i(c)<<1|d.i(c-1)>>>31;return new o(l,d.h)}function de(d,a){var l=a>>5;a%=32;for(var c=d.g.length-l,h=[],p=0;p<c;p++)h[p]=0<a?d.i(p+l)>>>a|d.i(p+l+1)<<32-a:d.i(p+l);return new o(h,d.h)}r.prototype.digest=r.prototype.v,r.prototype.reset=r.prototype.s,r.prototype.update=r.prototype.u,o.prototype.add=o.prototype.add,o.prototype.multiply=o.prototype.j,o.prototype.modulo=o.prototype.A,o.prototype.compare=o.prototype.l,o.prototype.toNumber=o.prototype.m,o.prototype.toString=o.prototype.toString,o.prototype.getBits=o.prototype.i,o.fromNumber=g,o.fromString=y,zn=o}).apply(typeof an<"u"?an:typeof self<"u"?self:typeof window<"u"?window:{});const un="4.8.0";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class M{constructor(e){this.uid=e}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(e){return e.uid===this.uid}}M.UNAUTHENTICATED=new M(null),M.GOOGLE_CREDENTIALS=new M("google-credentials-uid"),M.FIRST_PARTY=new M("first-party-uid"),M.MOCK_USER=new M("mock-user");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let _e="11.10.0";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const me=new Bn("@firebase/firestore");function qe(n,...e){if(me.logLevel<=A.DEBUG){const t=e.map(kt);me.debug(`Firestore (${_e}): ${n}`,...t)}}function Dt(n,...e){if(me.logLevel<=A.ERROR){const t=e.map(kt);me.error(`Firestore (${_e}): ${n}`,...t)}}function qn(n,...e){if(me.logLevel<=A.WARN){const t=e.map(kt);me.warn(`Firestore (${_e}): ${n}`,...t)}}function kt(n){if(typeof n=="string")return n;try{/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/return function(t){return JSON.stringify(t)}(n)}catch{return n}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function R(n,e,t){let r="Unexpected state";typeof e=="string"?r=e:t=e,Hn(n,r,t)}function Hn(n,e,t){let r=`FIRESTORE (${_e}) INTERNAL ASSERTION FAILED: ${e} (ID: ${n.toString(16)})`;if(t!==void 0)try{r+=" CONTEXT: "+JSON.stringify(t)}catch{r+=" CONTEXT: "+t}throw Dt(r),new Error(r)}function $(n,e,t,r){let i="Unexpected state";typeof t=="string"?i=t:r=t,n||Hn(e,i,r)}function Ce(n,e){return n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ln="ok",fs="cancelled",ve="unknown",E="invalid-argument",ps="deadline-exceeded",ms="not-found",gs="permission-denied",wt="unauthenticated",_s="resource-exhausted",ae="failed-precondition",ys="aborted",vs="out-of-range",Wn="unimplemented",ws="internal",Es="unavailable";class v extends ge{constructor(e,t){super(e,t),this.code=e,this.message=t,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gn{constructor(e,t){this.user=t,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${e}`)}}class bs{getToken(){return Promise.resolve(null)}invalidateToken(){}start(e,t){e.enqueueRetryable(()=>t(M.UNAUTHENTICATED))}shutdown(){}}class Is{constructor(e){this.token=e,this.changeListener=null}getToken(){return Promise.resolve(this.token)}invalidateToken(){}start(e,t){this.changeListener=t,e.enqueueRetryable(()=>t(this.token.user))}shutdown(){this.changeListener=null}}class Ts{constructor(e){this.auth=null,e.onInit(t=>{this.auth=t})}getToken(){return this.auth?this.auth.getToken().then(e=>e?($(typeof e.accessToken=="string",42297,{t:e}),new Gn(e.accessToken,new M(this.auth.getUid()))):null):Promise.resolve(null)}invalidateToken(){}start(e,t){}shutdown(){}}class As{constructor(e,t,r){this.i=e,this.o=t,this.u=r,this.type="FirstParty",this.user=M.FIRST_PARTY,this.l=new Map}h(){return this.u?this.u():null}get headers(){this.l.set("X-Goog-AuthUser",this.i);const e=this.h();return e&&this.l.set("Authorization",e),this.o&&this.l.set("X-Goog-Iam-Authorization-Token",this.o),this.l}}class Vs{constructor(e,t,r){this.i=e,this.o=t,this.u=r}getToken(){return Promise.resolve(new As(this.i,this.o,this.u))}start(e,t){e.enqueueRetryable(()=>t(M.FIRST_PARTY))}shutdown(){}invalidateToken(){}}class cn{constructor(e){this.value=e,this.type="AppCheck",this.headers=new Map,e&&e.length>0&&this.headers.set("x-firebase-appcheck",this.value)}}class Ss{constructor(e,t){this.m=t,this.appCheck=null,this.T=null,Yi(e)&&e.settings.appCheckToken&&(this.T=e.settings.appCheckToken),t.onInit(r=>{this.appCheck=r})}getToken(){return this.T?Promise.resolve(new cn(this.T)):this.appCheck?this.appCheck.getToken().then(e=>e?($(typeof e.token=="string",3470,{tokenResult:e}),new cn(e.token)):null):Promise.resolve(null)}invalidateToken(){}start(e,t){}shutdown(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ps{constructor(e,t,r,i,s,o,f,m,g,y){this.databaseId=e,this.appId=t,this.persistenceKey=r,this.host=i,this.ssl=s,this.forceLongPolling=o,this.autoDetectLongPolling=f,this.longPollingOptions=m,this.useFetchStreams=g,this.isUsingEmulator=y}}const Et="(default)";class Ae{constructor(e,t){this.projectId=e,this.database=t||Et}static empty(){return new Ae("","")}get isDefaultDatabase(){return this.database===Et}isEqual(e){return e instanceof Ae&&e.projectId===this.projectId&&e.database===this.database}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Rs(n){const e=typeof self<"u"&&(self.crypto||self.msCrypto),t=new Uint8Array(n);if(e&&typeof e.getRandomValues=="function")e.getRandomValues(t);else for(let r=0;r<n;r++)t[r]=Math.floor(256*Math.random());return t}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Cs{static newId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",t=62*Math.floor(4.129032258064516);let r="";for(;r.length<20;){const i=Rs(40);for(let s=0;s<i.length;++s)r.length<20&&i[s]<t&&(r+=e.charAt(i[s]%62))}return r}}function S(n,e){return n<e?-1:n>e?1:0}function bt(n,e){let t=0;for(;t<n.length&&t<e.length;){const r=n.codePointAt(t),i=e.codePointAt(t);if(r!==i){if(r<128&&i<128)return S(r,i);{const s=new TextEncoder,o=Ds(s.encode(hn(n,t)),s.encode(hn(e,t)));return o!==0?o:S(r,i)}}t+=r>65535?2:1}return S(n.length,e.length)}function hn(n,e){return n.codePointAt(e)>65535?n.substring(e,e+2):n.substring(e,e+1)}function Ds(n,e){for(let t=0;t<n.length&&t<e.length;++t)if(n[t]!==e[t])return S(n[t],e[t]);return S(n.length,e.length)}function Kn(n,e,t){return n.length===e.length&&n.every((r,i)=>t(r,e[i]))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dn="__name__";class q{constructor(e,t,r){t===void 0?t=0:t>e.length&&R(637,{offset:t,range:e.length}),r===void 0?r=e.length-t:r>e.length-t&&R(1746,{length:r,range:e.length-t}),this.segments=e,this.offset=t,this.len=r}get length(){return this.len}isEqual(e){return q.comparator(this,e)===0}child(e){const t=this.segments.slice(this.offset,this.limit());return e instanceof q?e.forEach(r=>{t.push(r)}):t.push(e),this.construct(t)}limit(){return this.offset+this.length}popFirst(e){return e=e===void 0?1:e,this.construct(this.segments,this.offset+e,this.length-e)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(e){return this.segments[this.offset+e]}isEmpty(){return this.length===0}isPrefixOf(e){if(e.length<this.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}isImmediateParentOf(e){if(this.length+1!==e.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}forEach(e){for(let t=this.offset,r=this.limit();t<r;t++)e(this.segments[t])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(e,t){const r=Math.min(e.length,t.length);for(let i=0;i<r;i++){const s=q.compareSegments(e.get(i),t.get(i));if(s!==0)return s}return S(e.length,t.length)}static compareSegments(e,t){const r=q.isNumericId(e),i=q.isNumericId(t);return r&&!i?-1:!r&&i?1:r&&i?q.extractNumericId(e).compare(q.extractNumericId(t)):bt(e,t)}static isNumericId(e){return e.startsWith("__id")&&e.endsWith("__")}static extractNumericId(e){return zn.fromString(e.substring(4,e.length-2))}}class C extends q{construct(e,t,r){return new C(e,t,r)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...e){const t=[];for(const r of e){if(r.indexOf("//")>=0)throw new v(E,`Invalid segment (${r}). Paths must not contain // in them.`);t.push(...r.split("/").filter(i=>i.length>0))}return new C(t)}static emptyPath(){return new C([])}}const ks=/^[_a-zA-Z][_a-zA-Z0-9]*$/;class B extends q{construct(e,t,r){return new B(e,t,r)}static isValidIdentifier(e){return ks.test(e)}canonicalString(){return this.toArray().map(e=>(e=e.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),B.isValidIdentifier(e)||(e="`"+e+"`"),e)).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)===dn}static keyField(){return new B([dn])}static fromServerFormat(e){const t=[];let r="",i=0;const s=()=>{if(r.length===0)throw new v(E,`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);t.push(r),r=""};let o=!1;for(;i<e.length;){const f=e[i];if(f==="\\"){if(i+1===e.length)throw new v(E,"Path has trailing escape character: "+e);const m=e[i+1];if(m!=="\\"&&m!=="."&&m!=="`")throw new v(E,"Path has invalid escape sequence: "+e);r+=m,i+=2}else f==="`"?(o=!o,i++):f!=="."||o?(r+=f,i++):(s(),i++)}if(s(),o)throw new v(E,"Unterminated ` in path: "+e);return new B(t)}static emptyPath(){return new B([])}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class O{constructor(e){this.path=e}static fromPath(e){return new O(C.fromString(e))}static fromName(e){return new O(C.fromString(e).popFirst(5))}static empty(){return new O(C.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(e){return this.path.length>=2&&this.path.get(this.path.length-2)===e}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(e){return e!==null&&C.comparator(this.path,e.path)===0}toString(){return this.path.toString()}static comparator(e,t){return C.comparator(e.path,t.path)}static isDocumentKey(e){return e.length%2==0}static fromSegments(e){return new O(new C(e.slice()))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Qn(n,e,t){if(!t)throw new v(E,`Function ${n}() cannot be called with an empty ${e}.`)}function fn(n){if(!O.isDocumentKey(n))throw new v(E,`Invalid document reference. Document references must have an even number of segments, but ${n} has ${n.length}.`)}function pn(n){if(O.isDocumentKey(n))throw new v(E,`Invalid collection reference. Collection references must have an odd number of segments, but ${n} has ${n.length}.`)}function Jn(n){return typeof n=="object"&&n!==null&&(Object.getPrototypeOf(n)===Object.prototype||Object.getPrototypeOf(n)===null)}function Ze(n){if(n===void 0)return"undefined";if(n===null)return"null";if(typeof n=="string")return n.length>20&&(n=`${n.substring(0,20)}...`),JSON.stringify(n);if(typeof n=="number"||typeof n=="boolean")return""+n;if(typeof n=="object"){if(n instanceof Array)return"an array";{const e=function(r){return r.constructor?r.constructor.name:null}(n);return e?`a custom ${e} object`:"an object"}}return typeof n=="function"?"a function":R(12329,{type:typeof n})}function De(n,e){if("_delegate"in n&&(n=n._delegate),!(n instanceof e)){if(e.name===n.constructor.name)throw new v(E,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{const t=Ze(n);throw new v(E,`Expected type '${e.name}', but it was: ${t}`)}}return n}function Ns(n,e){if(e<=0)throw new v(E,`Function ${n}() requires a positive number, but it was: ${e}.`)}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Yn(n){const e={};return n.timeoutSeconds!==void 0&&(e.timeoutSeconds=n.timeoutSeconds),e}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Me=null;function Os(){return Me===null?Me=function(){return 268435456+Math.round(2147483648*Math.random())}():Me++,"0x"+Me.toString(16)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Fs(n){return n==null}function He(n){return n===0&&1/n==-1/0}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dt="RestConnection",xs={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery"};class Ms{get P(){return!1}constructor(e){this.databaseInfo=e,this.databaseId=e.databaseId;const t=e.ssl?"https":"http",r=encodeURIComponent(this.databaseId.projectId),i=encodeURIComponent(this.databaseId.database);this.A=t+"://"+e.host,this.R=`projects/${r}/databases/${i}`,this.V=this.databaseId.database===Et?`project_id=${r}`:`project_id=${r}&database_id=${i}`}I(e,t,r,i,s){const o=Os(),f=this.p(e,t.toUriEncodedString());qe(dt,`Sending RPC '${e}' ${o}:`,f,r);const m={"google-cloud-resource-prefix":this.R,"x-goog-request-params":this.V};this.v(m,i,s);const{host:g}=new URL(f),y=Rt(g);return this.F(e,f,m,r,y).then(w=>(qe(dt,`Received RPC '${e}' ${o}: `,w),w),w=>{throw qn(dt,`RPC '${e}' ${o} failed with error: `,w,"url: ",f,"request:",r),w})}D(e,t,r,i,s,o){return this.I(e,t,r,i,s)}v(e,t,r){e["X-Goog-Api-Client"]=function(){return"gl-js/ fire/"+_e}(),e["Content-Type"]="text/plain",this.databaseInfo.appId&&(e["X-Firebase-GMPID"]=this.databaseInfo.appId),t&&t.headers.forEach((i,s)=>e[s]=i),r&&r.headers.forEach((i,s)=>e[s]=i)}p(e,t){const r=xs[e];return`${this.A}/v1/${t}:${r}`}terminate(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var mn,b;function gn(n){if(n===void 0)return Dt("RPC_ERROR","HTTP error has no status"),ve;switch(n){case 200:return ln;case 400:return ae;case 401:return wt;case 403:return gs;case 404:return ms;case 409:return ys;case 416:return vs;case 429:return _s;case 499:return fs;case 500:return ve;case 501:return Wn;case 503:return Es;case 504:return ps;default:return n>=200&&n<300?ln:n>=400&&n<500?ae:n>=500&&n<600?ws:ve}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */(b=mn||(mn={}))[b.OK=0]="OK",b[b.CANCELLED=1]="CANCELLED",b[b.UNKNOWN=2]="UNKNOWN",b[b.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",b[b.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",b[b.NOT_FOUND=5]="NOT_FOUND",b[b.ALREADY_EXISTS=6]="ALREADY_EXISTS",b[b.PERMISSION_DENIED=7]="PERMISSION_DENIED",b[b.UNAUTHENTICATED=16]="UNAUTHENTICATED",b[b.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",b[b.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",b[b.ABORTED=10]="ABORTED",b[b.OUT_OF_RANGE=11]="OUT_OF_RANGE",b[b.UNIMPLEMENTED=12]="UNIMPLEMENTED",b[b.INTERNAL=13]="INTERNAL",b[b.UNAVAILABLE=14]="UNAVAILABLE",b[b.DATA_LOSS=15]="DATA_LOSS";class Bs extends Ms{S(e,t){throw new Error("Not supported by FetchConnection")}async F(e,t,r,i,s){var o;const f=JSON.stringify(i);let m;try{const g={method:"POST",headers:r,body:f};s&&(g.credentials="include"),m=await fetch(t,g)}catch(g){const y=g;throw new v(gn(y.status),"Request failed with error: "+y.statusText)}if(!m.ok){let g=await m.json();Array.isArray(g)&&(g=g[0]);const y=(o=g?.error)===null||o===void 0?void 0:o.message;throw new v(gn(m.status),`Request failed with error: ${y??m.statusText}`)}return m.json()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function _n(n){let e=0;for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&e++;return e}function ke(n,e){for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&e(t,n[t])}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ls extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class X{constructor(e){this.binaryString=e}static fromBase64String(e){const t=function(i){try{return atob(i)}catch(s){throw typeof DOMException<"u"&&s instanceof DOMException?new Ls("Invalid base64 string: "+s):s}}(e);return new X(t)}static fromUint8Array(e){const t=function(i){let s="";for(let o=0;o<i.length;++o)s+=String.fromCharCode(i[o]);return s}(e);return new X(t)}[Symbol.iterator](){let e=0;return{next:()=>e<this.binaryString.length?{value:this.binaryString.charCodeAt(e++),done:!1}:{value:void 0,done:!0}}}toBase64(){return function(t){return btoa(t)}(this.binaryString)}toUint8Array(){return function(t){const r=new Uint8Array(t.length);for(let i=0;i<t.length;i++)r[i]=t.charCodeAt(i);return r}(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(e){return S(this.binaryString,e.binaryString)}isEqual(e){return this.binaryString===e.binaryString}}X.EMPTY_BYTE_STRING=new X("");const $s=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function ue(n){if($(!!n,39018),typeof n=="string"){let e=0;const t=$s.exec(n);if($(!!t,46558,{timestamp:n}),t[1]){let i=t[1];i=(i+"000000000").substr(0,9),e=Number(i)}const r=new Date(n);return{seconds:Math.floor(r.getTime()/1e3),nanos:e}}return{seconds:D(n.seconds),nanos:D(n.nanos)}}function D(n){return typeof n=="number"?n:typeof n=="string"?Number(n):0}function Ve(n){return typeof n=="string"?X.fromBase64String(n):X.fromUint8Array(n)}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function U(n,e){const t={typeString:n};return e&&(t.value=e),t}function Ne(n,e){if(!Jn(n))throw new v(E,"JSON must be an object");let t;for(const r in e)if(e[r]){const i=e[r].typeString,s="value"in e[r]?{value:e[r].value}:void 0;if(!(r in n)){t=`JSON missing required field: '${r}'`;break}const o=n[r];if(i&&typeof o!==i){t=`JSON field '${r}' must be a ${i}.`;break}if(s!==void 0&&o!==s.value){t=`Expected '${r}' field to equal '${s.value}'`;break}}if(t)throw new v(E,t);return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yn=-62135596800,vn=1e6;class N{static now(){return N.fromMillis(Date.now())}static fromDate(e){return N.fromMillis(e.getTime())}static fromMillis(e){const t=Math.floor(e/1e3),r=Math.floor((e-1e3*t)*vn);return new N(t,r)}constructor(e,t){if(this.seconds=e,this.nanoseconds=t,t<0)throw new v(E,"Timestamp nanoseconds out of range: "+t);if(t>=1e9)throw new v(E,"Timestamp nanoseconds out of range: "+t);if(e<yn)throw new v(E,"Timestamp seconds out of range: "+e);if(e>=253402300800)throw new v(E,"Timestamp seconds out of range: "+e)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/vn}_compareTo(e){return this.seconds===e.seconds?S(this.nanoseconds,e.nanoseconds):S(this.seconds,e.seconds)}isEqual(e){return e.seconds===this.seconds&&e.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{type:N._jsonSchemaVersion,seconds:this.seconds,nanoseconds:this.nanoseconds}}static fromJSON(e){if(Ne(e,N._jsonSchema))return new N(e.seconds,e.nanoseconds)}valueOf(){const e=this.seconds-yn;return String(e).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}}N._jsonSchemaVersion="firestore/timestamp/1.0",N._jsonSchema={type:U("string",N._jsonSchemaVersion),seconds:U("number"),nanoseconds:U("number")};function Xn(n){var e,t;return((t=(((e=n?.mapValue)===null||e===void 0?void 0:e.fields)||{}).__type__)===null||t===void 0?void 0:t.stringValue)==="server_timestamp"}function Zn(n){const e=n.mapValue.fields.__previous_value__;return Xn(e)?Zn(e):e}function Se(n){const e=ue(n.mapValue.fields.__local_write_time__.timestampValue);return new N(e.seconds,e.nanos)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const er="__type__",js="__max__",Be={},tr="__vector__",We="value";function le(n){return"nullValue"in n?0:"booleanValue"in n?1:"integerValue"in n||"doubleValue"in n?2:"timestampValue"in n?3:"stringValue"in n?5:"bytesValue"in n?6:"referenceValue"in n?7:"geoPointValue"in n?8:"arrayValue"in n?9:"mapValue"in n?Xn(n)?4:function(t){return(((t.mapValue||{}).fields||{}).__type__||{}).stringValue===js}(n)?9007199254740991:function(t){var r,i;return((i=(((r=t?.mapValue)===null||r===void 0?void 0:r.fields)||{})[er])===null||i===void 0?void 0:i.stringValue)===tr}(n)?10:11:R(28295,{value:n})}function Ge(n,e){if(n===e)return!0;const t=le(n);if(t!==le(e))return!1;switch(t){case 0:case 9007199254740991:return!0;case 1:return n.booleanValue===e.booleanValue;case 4:return Se(n).isEqual(Se(e));case 3:return function(i,s){if(typeof i.timestampValue=="string"&&typeof s.timestampValue=="string"&&i.timestampValue.length===s.timestampValue.length)return i.timestampValue===s.timestampValue;const o=ue(i.timestampValue),f=ue(s.timestampValue);return o.seconds===f.seconds&&o.nanos===f.nanos}(n,e);case 5:return n.stringValue===e.stringValue;case 6:return function(i,s){return Ve(i.bytesValue).isEqual(Ve(s.bytesValue))}(n,e);case 7:return n.referenceValue===e.referenceValue;case 8:return function(i,s){return D(i.geoPointValue.latitude)===D(s.geoPointValue.latitude)&&D(i.geoPointValue.longitude)===D(s.geoPointValue.longitude)}(n,e);case 2:return function(i,s){if("integerValue"in i&&"integerValue"in s)return D(i.integerValue)===D(s.integerValue);if("doubleValue"in i&&"doubleValue"in s){const o=D(i.doubleValue),f=D(s.doubleValue);return o===f?He(o)===He(f):isNaN(o)&&isNaN(f)}return!1}(n,e);case 9:return Kn(n.arrayValue.values||[],e.arrayValue.values||[],Ge);case 10:case 11:return function(i,s){const o=i.mapValue.fields||{},f=s.mapValue.fields||{};if(_n(o)!==_n(f))return!1;for(const m in o)if(o.hasOwnProperty(m)&&(f[m]===void 0||!Ge(o[m],f[m])))return!1;return!0}(n,e);default:return R(52216,{left:n})}}function Pe(n,e){return(n.values||[]).find(t=>Ge(t,e))!==void 0}function Ke(n,e){if(n===e)return 0;const t=le(n),r=le(e);if(t!==r)return S(t,r);switch(t){case 0:case 9007199254740991:return 0;case 1:return S(n.booleanValue,e.booleanValue);case 2:return function(s,o){const f=D(s.integerValue||s.doubleValue),m=D(o.integerValue||o.doubleValue);return f<m?-1:f>m?1:f===m?0:isNaN(f)?isNaN(m)?0:-1:1}(n,e);case 3:return wn(n.timestampValue,e.timestampValue);case 4:return wn(Se(n),Se(e));case 5:return bt(n.stringValue,e.stringValue);case 6:return function(s,o){const f=Ve(s),m=Ve(o);return f.compareTo(m)}(n.bytesValue,e.bytesValue);case 7:return function(s,o){const f=s.split("/"),m=o.split("/");for(let g=0;g<f.length&&g<m.length;g++){const y=S(f[g],m[g]);if(y!==0)return y}return S(f.length,m.length)}(n.referenceValue,e.referenceValue);case 8:return function(s,o){const f=S(D(s.latitude),D(o.latitude));return f!==0?f:S(D(s.longitude),D(o.longitude))}(n.geoPointValue,e.geoPointValue);case 9:return En(n.arrayValue,e.arrayValue);case 10:return function(s,o){var f,m,g,y;const w=s.fields||{},_=o.fields||{},T=(f=w[We])===null||f===void 0?void 0:f.arrayValue,I=(m=_[We])===null||m===void 0?void 0:m.arrayValue,P=S(((g=T?.values)===null||g===void 0?void 0:g.length)||0,((y=I?.values)===null||y===void 0?void 0:y.length)||0);return P!==0?P:En(T,I)}(n.mapValue,e.mapValue);case 11:return function(s,o){if(s===Be&&o===Be)return 0;if(s===Be)return 1;if(o===Be)return-1;const f=s.fields||{},m=Object.keys(f),g=o.fields||{},y=Object.keys(g);m.sort(),y.sort();for(let w=0;w<m.length&&w<y.length;++w){const _=bt(m[w],y[w]);if(_!==0)return _;const T=Ke(f[m[w]],g[y[w]]);if(T!==0)return T}return S(m.length,y.length)}(n.mapValue,e.mapValue);default:throw R(23264,{C:t})}}function wn(n,e){if(typeof n=="string"&&typeof e=="string"&&n.length===e.length)return S(n,e);const t=ue(n),r=ue(e),i=S(t.seconds,r.seconds);return i!==0?i:S(t.nanos,r.nanos)}function En(n,e){const t=n.values||[],r=e.values||[];for(let i=0;i<t.length&&i<r.length;++i){const s=Ke(t[i],r[i]);if(s)return s}return S(t.length,r.length)}function bn(n,e){return{referenceValue:`projects/${n.projectId}/databases/${n.database}/documents/${e.path.canonicalString()}`}}function nr(n){return!!n&&"arrayValue"in n}function In(n){return!!n&&"nullValue"in n}function Tn(n){return!!n&&"doubleValue"in n&&isNaN(Number(n.doubleValue))}function ft(n){return!!n&&"mapValue"in n}function we(n){if(n.geoPointValue)return{geoPointValue:Object.assign({},n.geoPointValue)};if(n.timestampValue&&typeof n.timestampValue=="object")return{timestampValue:Object.assign({},n.timestampValue)};if(n.mapValue){const e={mapValue:{fields:{}}};return ke(n.mapValue.fields,(t,r)=>e.mapValue.fields[t]=we(r)),e}if(n.arrayValue){const e={arrayValue:{values:[]}};for(let t=0;t<(n.arrayValue.values||[]).length;++t)e.arrayValue.values[t]=we(n.arrayValue.values[t]);return e}return Object.assign({},n)}class An{constructor(e,t){this.position=e,this.inclusive=t}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class rr{}class z extends rr{constructor(e,t,r){super(),this.field=e,this.op=t,this.value=r}static create(e,t,r){return e.isKeyField()?t==="in"||t==="not-in"?this.createKeyFieldInFilter(e,t,r):new Us(e,t,r):t==="array-contains"?new Hs(e,r):t==="in"?new Ws(e,r):t==="not-in"?new Gs(e,r):t==="array-contains-any"?new Ks(e,r):new z(e,t,r)}static createKeyFieldInFilter(e,t,r){return t==="in"?new zs(e,r):new qs(e,r)}matches(e){const t=e.data.field(this.field);return this.op==="!="?t!==null&&t.nullValue===void 0&&this.matchesComparison(Ke(t,this.value)):t!==null&&le(this.value)===le(t)&&this.matchesComparison(Ke(t,this.value))}matchesComparison(e){switch(this.op){case"<":return e<0;case"<=":return e<=0;case"==":return e===0;case"!=":return e!==0;case">":return e>0;case">=":return e>=0;default:return R(47266,{operator:this.op})}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}}class Oe extends rr{constructor(e,t){super(),this.filters=e,this.op=t,this.N=null}static create(e,t){return new Oe(e,t)}matches(e){return function(r){return r.op==="and"}(this)?this.filters.find(t=>!t.matches(e))===void 0:this.filters.find(t=>t.matches(e))!==void 0}getFlattenedFilters(){return this.N!==null||(this.N=this.filters.reduce((e,t)=>e.concat(t.getFlattenedFilters()),[])),this.N}getFilters(){return Object.assign([],this.filters)}}class Us extends z{constructor(e,t,r){super(e,t,r),this.key=O.fromName(r.referenceValue)}matches(e){const t=O.comparator(e.key,this.key);return this.matchesComparison(t)}}class zs extends z{constructor(e,t){super(e,"in",t),this.keys=ir("in",t)}matches(e){return this.keys.some(t=>t.isEqual(e.key))}}class qs extends z{constructor(e,t){super(e,"not-in",t),this.keys=ir("not-in",t)}matches(e){return!this.keys.some(t=>t.isEqual(e.key))}}function ir(n,e){var t;return(((t=e.arrayValue)===null||t===void 0?void 0:t.values)||[]).map(r=>O.fromName(r.referenceValue))}class Hs extends z{constructor(e,t){super(e,"array-contains",t)}matches(e){const t=e.data.field(this.field);return nr(t)&&Pe(t.arrayValue,this.value)}}class Ws extends z{constructor(e,t){super(e,"in",t)}matches(e){const t=e.data.field(this.field);return t!==null&&Pe(this.value.arrayValue,t)}}class Gs extends z{constructor(e,t){super(e,"not-in",t)}matches(e){if(Pe(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;const t=e.data.field(this.field);return t!==null&&t.nullValue===void 0&&!Pe(this.value.arrayValue,t)}}class Ks extends z{constructor(e,t){super(e,"array-contains-any",t)}matches(e){const t=e.data.field(this.field);return!(!nr(t)||!t.arrayValue.values)&&t.arrayValue.values.some(r=>Pe(this.value.arrayValue,r))}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qe{constructor(e,t="asc"){this.field=e,this.dir=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class F{static fromTimestamp(e){return new F(e)}static min(){return new F(new N(0,0))}static max(){return new F(new N(253402300799,999999999))}constructor(e){this.timestamp=e}compareTo(e){return this.timestamp._compareTo(e.timestamp)}isEqual(e){return this.timestamp.isEqual(e.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Je{constructor(e,t){this.comparator=e,this.root=t||x.EMPTY}insert(e,t){return new Je(this.comparator,this.root.insert(e,t,this.comparator).copy(null,null,x.BLACK,null,null))}remove(e){return new Je(this.comparator,this.root.remove(e,this.comparator).copy(null,null,x.BLACK,null,null))}get(e){let t=this.root;for(;!t.isEmpty();){const r=this.comparator(e,t.key);if(r===0)return t.value;r<0?t=t.left:r>0&&(t=t.right)}return null}indexOf(e){let t=0,r=this.root;for(;!r.isEmpty();){const i=this.comparator(e,r.key);if(i===0)return t+r.left.size;i<0?r=r.left:(t+=r.left.size+1,r=r.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(e){return this.root.inorderTraversal(e)}forEach(e){this.inorderTraversal((t,r)=>(e(t,r),!1))}toString(){const e=[];return this.inorderTraversal((t,r)=>(e.push(`${t}:${r}`),!1)),`{${e.join(", ")}}`}reverseTraversal(e){return this.root.reverseTraversal(e)}getIterator(){return new Le(this.root,null,this.comparator,!1)}getIteratorFrom(e){return new Le(this.root,e,this.comparator,!1)}getReverseIterator(){return new Le(this.root,null,this.comparator,!0)}getReverseIteratorFrom(e){return new Le(this.root,e,this.comparator,!0)}}class Le{constructor(e,t,r,i){this.isReverse=i,this.nodeStack=[];let s=1;for(;!e.isEmpty();)if(s=t?r(e.key,t):1,t&&i&&(s*=-1),s<0)e=this.isReverse?e.left:e.right;else{if(s===0){this.nodeStack.push(e);break}this.nodeStack.push(e),e=this.isReverse?e.right:e.left}}getNext(){let e=this.nodeStack.pop();const t={key:e.key,value:e.value};if(this.isReverse)for(e=e.left;!e.isEmpty();)this.nodeStack.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.nodeStack.push(e),e=e.left;return t}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;const e=this.nodeStack[this.nodeStack.length-1];return{key:e.key,value:e.value}}}class x{constructor(e,t,r,i,s){this.key=e,this.value=t,this.color=r??x.RED,this.left=i??x.EMPTY,this.right=s??x.EMPTY,this.size=this.left.size+1+this.right.size}copy(e,t,r,i,s){return new x(e??this.key,t??this.value,r??this.color,i??this.left,s??this.right)}isEmpty(){return!1}inorderTraversal(e){return this.left.inorderTraversal(e)||e(this.key,this.value)||this.right.inorderTraversal(e)}reverseTraversal(e){return this.right.reverseTraversal(e)||e(this.key,this.value)||this.left.reverseTraversal(e)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(e,t,r){let i=this;const s=r(e,i.key);return i=s<0?i.copy(null,null,null,i.left.insert(e,t,r),null):s===0?i.copy(null,t,null,null,null):i.copy(null,null,null,null,i.right.insert(e,t,r)),i.fixUp()}removeMin(){if(this.left.isEmpty())return x.EMPTY;let e=this;return e.left.isRed()||e.left.left.isRed()||(e=e.moveRedLeft()),e=e.copy(null,null,null,e.left.removeMin(),null),e.fixUp()}remove(e,t){let r,i=this;if(t(e,i.key)<0)i.left.isEmpty()||i.left.isRed()||i.left.left.isRed()||(i=i.moveRedLeft()),i=i.copy(null,null,null,i.left.remove(e,t),null);else{if(i.left.isRed()&&(i=i.rotateRight()),i.right.isEmpty()||i.right.isRed()||i.right.left.isRed()||(i=i.moveRedRight()),t(e,i.key)===0){if(i.right.isEmpty())return x.EMPTY;r=i.right.min(),i=i.copy(r.key,r.value,null,null,i.right.removeMin())}i=i.copy(null,null,null,null,i.right.remove(e,t))}return i.fixUp()}isRed(){return this.color}fixUp(){let e=this;return e.right.isRed()&&!e.left.isRed()&&(e=e.rotateLeft()),e.left.isRed()&&e.left.left.isRed()&&(e=e.rotateRight()),e.left.isRed()&&e.right.isRed()&&(e=e.colorFlip()),e}moveRedLeft(){let e=this.colorFlip();return e.right.left.isRed()&&(e=e.copy(null,null,null,null,e.right.rotateRight()),e=e.rotateLeft(),e=e.colorFlip()),e}moveRedRight(){let e=this.colorFlip();return e.left.left.isRed()&&(e=e.rotateRight(),e=e.colorFlip()),e}rotateLeft(){const e=this.copy(null,null,x.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)}rotateRight(){const e=this.copy(null,null,x.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)}colorFlip(){const e=this.left.copy(null,null,!this.left.color,null,null),t=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,e,t)}checkMaxDepth(){const e=this.check();return Math.pow(2,e)<=this.size+1}check(){if(this.isRed()&&this.left.isRed())throw R(43730,{key:this.key,value:this.value});if(this.right.isRed())throw R(14113,{key:this.key,value:this.value});const e=this.left.check();if(e!==this.right.check())throw R(27949);return e+(this.isRed()?0:1)}}x.EMPTY=null,x.RED=!0,x.BLACK=!1;x.EMPTY=new class{constructor(){this.size=0}get key(){throw R(57766)}get value(){throw R(16141)}get color(){throw R(16727)}get left(){throw R(29726)}get right(){throw R(36894)}copy(e,t,r,i,s){return this}insert(e,t,r){return new x(e,t)}remove(e,t){return this}isEmpty(){return!0}inorderTraversal(e){return!1}reverseTraversal(e){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Re{constructor(e){this.comparator=e,this.data=new Je(this.comparator)}has(e){return this.data.get(e)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(e){return this.data.indexOf(e)}forEach(e){this.data.inorderTraversal((t,r)=>(e(t),!1))}forEachInRange(e,t){const r=this.data.getIteratorFrom(e[0]);for(;r.hasNext();){const i=r.getNext();if(this.comparator(i.key,e[1])>=0)return;t(i.key)}}forEachWhile(e,t){let r;for(r=t!==void 0?this.data.getIteratorFrom(t):this.data.getIterator();r.hasNext();)if(!e(r.getNext().key))return}firstAfterOrEqual(e){const t=this.data.getIteratorFrom(e);return t.hasNext()?t.getNext().key:null}getIterator(){return new Vn(this.data.getIterator())}getIteratorFrom(e){return new Vn(this.data.getIteratorFrom(e))}add(e){return this.copy(this.data.remove(e).insert(e,!0))}delete(e){return this.has(e)?this.copy(this.data.remove(e)):this}isEmpty(){return this.data.isEmpty()}unionWith(e){let t=this;return t.size<e.size&&(t=e,e=this),e.forEach(r=>{t=t.add(r)}),t}isEqual(e){if(!(e instanceof Re)||this.size!==e.size)return!1;const t=this.data.getIterator(),r=e.data.getIterator();for(;t.hasNext();){const i=t.getNext().key,s=r.getNext().key;if(this.comparator(i,s)!==0)return!1}return!0}toArray(){const e=[];return this.forEach(t=>{e.push(t)}),e}toString(){const e=[];return this.forEach(t=>e.push(t)),"SortedSet("+e.toString()+")"}copy(e){const t=new Re(this.comparator);return t.data=e,t}}class Vn{constructor(e){this.iter=e}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ce{constructor(e){this.fields=e,e.sort(B.comparator)}static empty(){return new ce([])}unionWith(e){let t=new Re(B.comparator);for(const r of this.fields)t=t.add(r);for(const r of e)t=t.add(r);return new ce(t.toArray())}covers(e){for(const t of this.fields)if(t.isPrefixOf(e))return!0;return!1}isEqual(e){return Kn(this.fields,e.fields,(t,r)=>t.isEqual(r))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class L{constructor(e){this.value=e}static empty(){return new L({mapValue:{}})}field(e){if(e.isEmpty())return this.value;{let t=this.value;for(let r=0;r<e.length-1;++r)if(t=(t.mapValue.fields||{})[e.get(r)],!ft(t))return null;return t=(t.mapValue.fields||{})[e.lastSegment()],t||null}}set(e,t){this.getFieldsMap(e.popLast())[e.lastSegment()]=we(t)}setAll(e){let t=B.emptyPath(),r={},i=[];e.forEach((o,f)=>{if(!t.isImmediateParentOf(f)){const m=this.getFieldsMap(t);this.applyChanges(m,r,i),r={},i=[],t=f.popLast()}o?r[f.lastSegment()]=we(o):i.push(f.lastSegment())});const s=this.getFieldsMap(t);this.applyChanges(s,r,i)}delete(e){const t=this.field(e.popLast());ft(t)&&t.mapValue.fields&&delete t.mapValue.fields[e.lastSegment()]}isEqual(e){return Ge(this.value,e.value)}getFieldsMap(e){let t=this.value;t.mapValue.fields||(t.mapValue={fields:{}});for(let r=0;r<e.length;++r){let i=t.mapValue.fields[e.get(r)];ft(i)&&i.mapValue.fields||(i={mapValue:{fields:{}}},t.mapValue.fields[e.get(r)]=i),t=i}return t.mapValue.fields}applyChanges(e,t,r){ke(t,(i,s)=>e[i]=s);for(const i of r)delete e[i]}clone(){return new L(we(this.value))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class H{constructor(e,t,r,i,s,o,f){this.key=e,this.documentType=t,this.version=r,this.readTime=i,this.createTime=s,this.data=o,this.documentState=f}static newInvalidDocument(e){return new H(e,0,F.min(),F.min(),F.min(),L.empty(),0)}static newFoundDocument(e,t,r,i){return new H(e,1,t,F.min(),r,i,0)}static newNoDocument(e,t){return new H(e,2,t,F.min(),F.min(),L.empty(),0)}static newUnknownDocument(e,t){return new H(e,3,t,F.min(),F.min(),L.empty(),2)}convertToFoundDocument(e,t){return!this.createTime.isEqual(F.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=e),this.version=e,this.documentType=1,this.data=t,this.documentState=0,this}convertToNoDocument(e){return this.version=e,this.documentType=2,this.data=L.empty(),this.documentState=0,this}convertToUnknownDocument(e){return this.version=e,this.documentType=3,this.data=L.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=F.min(),this}setReadTime(e){return this.readTime=e,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(e){return e instanceof H&&this.key.isEqual(e.key)&&this.version.isEqual(e.version)&&this.documentType===e.documentType&&this.documentState===e.documentState&&this.data.isEqual(e.data)}mutableCopy(){return new H(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qs{constructor(e,t=null,r=[],i=[],s=null,o=null,f=null){this.path=e,this.collectionGroup=t,this.orderBy=r,this.filters=i,this.limit=s,this.startAt=o,this.endAt=f,this.O=null}}function Sn(n,e=null,t=[],r=[],i=null,s=null,o=null){return new Qs(n,e,t,r,i,s,o)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class et{constructor(e,t=null,r=[],i=[],s=null,o="F",f=null,m=null){this.path=e,this.collectionGroup=t,this.explicitOrderBy=r,this.filters=i,this.limit=s,this.limitType=o,this.startAt=f,this.endAt=m,this.q=null,this.B=null,this.$=null,this.startAt,this.endAt}}function Js(n){return n.collectionGroup!==null}function Ys(n){const e=Ce(n);if(e.q===null){e.q=[];const t=new Set;for(const s of e.explicitOrderBy)e.q.push(s),t.add(s.field.canonicalString());const r=e.explicitOrderBy.length>0?e.explicitOrderBy[e.explicitOrderBy.length-1].dir:"asc";(function(o){let f=new Re(B.comparator);return o.filters.forEach(m=>{m.getFlattenedFilters().forEach(g=>{g.isInequality()&&(f=f.add(g.field))})}),f})(e).forEach(s=>{t.has(s.canonicalString())||s.isKeyField()||e.q.push(new Qe(s,r))}),t.has(B.keyField().canonicalString())||e.q.push(new Qe(B.keyField(),r))}return e.q}function Xs(n){const e=Ce(n);return e.B||(e.B=Zs(e,Ys(n))),e.B}function Zs(n,e){if(n.limitType==="F")return Sn(n.path,n.collectionGroup,e,n.filters,n.limit,n.startAt,n.endAt);{e=e.map(i=>{const s=i.dir==="desc"?"asc":"desc";return new Qe(i.field,s)});const t=n.endAt?new An(n.endAt.position,n.endAt.inclusive):null,r=n.startAt?new An(n.startAt.position,n.startAt.inclusive):null;return Sn(n.path,n.collectionGroup,e,n.filters,n.limit,t,r)}}function It(n,e){const t=n.filters.concat([e]);return new et(n.path,n.collectionGroup,n.explicitOrderBy.slice(),t,n.limit,n.limitType,n.startAt,n.endAt)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function sr(n,e){if(n.useProto3Json){if(isNaN(e))return{doubleValue:"NaN"};if(e===1/0)return{doubleValue:"Infinity"};if(e===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:He(e)?"-0":e}}function eo(n,e){return function(r){return typeof r=="number"&&Number.isInteger(r)&&!He(r)&&r<=Number.MAX_SAFE_INTEGER&&r>=Number.MIN_SAFE_INTEGER}(e)?function(r){return{integerValue:""+r}}(e):sr(n,e)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tt{constructor(){this._=void 0}}class or extends tt{}class to extends tt{constructor(e){super(),this.elements=e}}class no extends tt{constructor(e){super(),this.elements=e}}class ro extends tt{constructor(e,t){super(),this.serializer=e,this.k=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class io{constructor(e,t){this.field=e,this.transform=t}}class te{constructor(e,t){this.updateTime=e,this.exists=t}static none(){return new te}static exists(e){return new te(void 0,e)}static updateTime(e){return new te(e)}get isNone(){return this.updateTime===void 0&&this.exists===void 0}isEqual(e){return this.exists===e.exists&&(this.updateTime?!!e.updateTime&&this.updateTime.isEqual(e.updateTime):!e.updateTime)}}class nt{}class ar extends nt{constructor(e,t,r,i=[]){super(),this.key=e,this.value=t,this.precondition=r,this.fieldTransforms=i,this.type=0}getFieldMask(){return null}}class Nt extends nt{constructor(e,t,r,i,s=[]){super(),this.key=e,this.data=t,this.fieldMask=r,this.precondition=i,this.fieldTransforms=s,this.type=1}getFieldMask(){return this.fieldMask}}class ur extends nt{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=2,this.fieldTransforms=[]}getFieldMask(){return null}}class so extends nt{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=3,this.fieldTransforms=[]}getFieldMask(){return null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const oo={asc:"ASCENDING",desc:"DESCENDING"},ao={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},uo={and:"AND",or:"OR"};class lo{constructor(e,t){this.databaseId=e,this.useProto3Json=t}}function Tt(n,e){return n.useProto3Json?`${new Date(1e3*e.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+e.nanoseconds).slice(-9)}Z`:{seconds:""+e.seconds,nanos:e.nanoseconds}}function co(n,e){return n.useProto3Json?e.toBase64():e.toUint8Array()}function ho(n,e){return Tt(n,e.toTimestamp())}function Ee(n){return $(!!n,49232),F.fromTimestamp(function(t){const r=ue(t);return new N(r.seconds,r.nanos)}(n))}function Ot(n,e){return At(n,e).canonicalString()}function At(n,e){const t=function(i){return new C(["projects",i.projectId,"databases",i.database])}(n).child("documents");return e===void 0?t:t.child(e)}function Ye(n,e){return Ot(n.databaseId,e.path)}function Vt(n,e){const t=function(i){const s=C.fromString(i);return $(cr(s),10190,{key:s.toString()}),s}(e);if(t.get(1)!==n.databaseId.projectId)throw new v(E,"Tried to deserialize key from different project: "+t.get(1)+" vs "+n.databaseId.projectId);if(t.get(3)!==n.databaseId.database)throw new v(E,"Tried to deserialize key from different database: "+t.get(3)+" vs "+n.databaseId.database);return new O(function(i){return $(i.length>4&&i.get(4)==="documents",29091,{key:i.toString()}),i.popFirst(5)}(t))}function Pn(n,e,t){return{name:Ye(n,e),fields:t.value.mapValue.fields}}function fo(n,e){return"found"in e?function(r,i){$(!!i.found,43571),i.found.name,i.found.updateTime;const s=Vt(r,i.found.name),o=Ee(i.found.updateTime),f=i.found.createTime?Ee(i.found.createTime):F.min(),m=new L({mapValue:{fields:i.found.fields}});return H.newFoundDocument(s,o,f,m)}(n,e):"missing"in e?function(r,i){$(!!i.missing,3894),$(!!i.readTime,22933);const s=Vt(r,i.missing),o=Ee(i.readTime);return H.newNoDocument(s,o)}(n,e):R(7234,{result:e})}function po(n,e){let t;if(e instanceof ar)t={update:Pn(n,e.key,e.value)};else if(e instanceof ur)t={delete:Ye(n,e.key)};else if(e instanceof Nt)t={update:Pn(n,e.key,e.data),updateMask:vo(e.fieldMask)};else{if(!(e instanceof so))return R(16599,{L:e.type});t={verify:Ye(n,e.key)}}return e.fieldTransforms.length>0&&(t.updateTransforms=e.fieldTransforms.map(r=>function(s,o){const f=o.transform;if(f instanceof or)return{fieldPath:o.field.canonicalString(),setToServerValue:"REQUEST_TIME"};if(f instanceof to)return{fieldPath:o.field.canonicalString(),appendMissingElements:{values:f.elements}};if(f instanceof no)return{fieldPath:o.field.canonicalString(),removeAllFromArray:{values:f.elements}};if(f instanceof ro)return{fieldPath:o.field.canonicalString(),increment:f.k};throw R(20930,{transform:o.transform})}(0,r))),e.precondition.isNone||(t.currentDocument=function(i,s){return s.updateTime!==void 0?{updateTime:ho(i,s.updateTime)}:s.exists!==void 0?{exists:s.exists}:R(27497)}(n,e.precondition)),t}function mo(n,e){const t={structuredQuery:{}},r=e.path;let i;e.collectionGroup!==null?(i=r,t.structuredQuery.from=[{collectionId:e.collectionGroup,allDescendants:!0}]):(i=r.popLast(),t.structuredQuery.from=[{collectionId:r.lastSegment()}]),t.parent=function(g,y){return Ot(g.databaseId,y)}(n,i);const s=function(g){if(g.length!==0)return lr(Oe.create(g,"and"))}(e.filters);s&&(t.structuredQuery.where=s);const o=function(g){if(g.length!==0)return g.map(y=>function(_){return{field:fe(_.field),direction:go(_.dir)}}(y))}(e.orderBy);o&&(t.structuredQuery.orderBy=o);const f=function(g,y){return g.useProto3Json||Fs(y)?y:{value:y}}(n,e.limit);return f!==null&&(t.structuredQuery.limit=f),e.startAt&&(t.structuredQuery.startAt=function(g){return{before:g.inclusive,values:g.position}}(e.startAt)),e.endAt&&(t.structuredQuery.endAt=function(g){return{before:!g.inclusive,values:g.position}}(e.endAt)),{M:t,parent:i}}function go(n){return oo[n]}function _o(n){return ao[n]}function yo(n){return uo[n]}function fe(n){return{fieldPath:n.canonicalString()}}function lr(n){return n instanceof z?function(t){if(t.op==="=="){if(Tn(t.value))return{unaryFilter:{field:fe(t.field),op:"IS_NAN"}};if(In(t.value))return{unaryFilter:{field:fe(t.field),op:"IS_NULL"}}}else if(t.op==="!="){if(Tn(t.value))return{unaryFilter:{field:fe(t.field),op:"IS_NOT_NAN"}};if(In(t.value))return{unaryFilter:{field:fe(t.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:fe(t.field),op:_o(t.op),value:t.value}}}(n):n instanceof Oe?function(t){const r=t.getFilters().map(i=>lr(i));return r.length===1?r[0]:{compositeFilter:{op:yo(t.op),filters:r}}}(n):R(54877,{filter:n})}function vo(n){const e=[];return n.fields.forEach(t=>e.push(t.canonicalString())),{fieldPaths:e}}function cr(n){return n.length>=4&&n.get(0)==="projects"&&n.get(2)==="databases"}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ft(n){return new lo(n,!0)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wo{}class Eo extends wo{constructor(e,t,r,i){super(),this.authCredentials=e,this.appCheckCredentials=t,this.connection=r,this.serializer=i,this.et=!1}rt(){if(this.et)throw new v(ae,"The client has already been terminated.")}I(e,t,r,i){return this.rt(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then(([s,o])=>this.connection.I(e,At(t,r),i,s,o)).catch(s=>{throw s.name==="FirebaseError"?(s.code===wt&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),s):new v(ve,s.toString())})}D(e,t,r,i,s){return this.rt(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then(([o,f])=>this.connection.D(e,At(t,r),i,o,f,s)).catch(o=>{throw o.name==="FirebaseError"?(o.code===wt&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),o):new v(ve,o.toString())})}terminate(){this.et=!0,this.connection.terminate()}}async function hr(n,e){const t=Ce(n),r={writes:e.map(i=>po(t.serializer,i))};await t.I("Commit",t.serializer.databaseId,C.emptyPath(),r)}async function bo(n,e){const t=Ce(n),r={documents:e.map(f=>Ye(t.serializer,f))},i=await t.D("BatchGetDocuments",t.serializer.databaseId,C.emptyPath(),r,e.length),s=new Map;i.forEach(f=>{const m=fo(t.serializer,f);s.set(m.key.toString(),m)});const o=[];return e.forEach(f=>{const m=s.get(f.toString());$(!!m,55234,{key:f}),o.push(m)}),o}async function Io(n,e){const t=Ce(n),{M:r,parent:i}=mo(t.serializer,Xs(e));return(await t.D("RunQuery",t.serializer.databaseId,i,{structuredQuery:r.structuredQuery})).filter(s=>!!s.document).map(s=>function(f,m,g){const y=Vt(f,m.name),w=Ee(m.updateTime),_=m.createTime?Ee(m.createTime):F.min(),T=new L({mapValue:{fields:m.fields}}),I=H.newFoundDocument(y,w,_,T);return g?I.setHasCommittedMutations():I}(t.serializer,s.document,void 0))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dr="ComponentProvider",be=new Map;function rt(n){if(n._terminated)throw new v(ae,"The client has already been terminated.");if(!be.has(n)){qe(dr,"Initializing Datastore");const e=function(s){return new Bs(s)}(function(s,o,f,m){return new Ps(s,o,f,m.host,m.ssl,m.experimentalForceLongPolling,m.experimentalAutoDetectLongPolling,Yn(m.experimentalLongPollingOptions),m.useFetchStreams,m.isUsingEmulator)}(n._databaseId,n.app.options.appId||"",n._persistenceKey,n._freezeSettings())),t=Ft(n._databaseId),r=function(s,o,f,m){return new Eo(s,o,f,m)}(n._authCredentials,n._appCheckCredentials,e,t);be.set(n,r)}return be.get(n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const To=1048576,fr="firestore.googleapis.com",Rn=!0;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Cn{constructor(e){var t,r;if(e.host===void 0){if(e.ssl!==void 0)throw new v(E,"Can't provide ssl option if host option is not set");this.host=fr,this.ssl=Rn}else this.host=e.host,this.ssl=(t=e.ssl)!==null&&t!==void 0?t:Rn;if(this.isUsingEmulator=e.emulatorOptions!==void 0,this.credentials=e.credentials,this.ignoreUndefinedProperties=!!e.ignoreUndefinedProperties,this.localCache=e.localCache,e.cacheSizeBytes===void 0)this.cacheSizeBytes=41943040;else{if(e.cacheSizeBytes!==-1&&e.cacheSizeBytes<To)throw new v(E,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=e.cacheSizeBytes}(function(s,o,f,m){if(o===!0&&m===!0)throw new v(E,`${s} and ${f} cannot be used together.`)})("experimentalForceLongPolling",e.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",e.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!e.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:e.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!e.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=Yn((r=e.experimentalLongPollingOptions)!==null&&r!==void 0?r:{}),function(s){if(s.timeoutSeconds!==void 0){if(isNaN(s.timeoutSeconds))throw new v(E,`invalid long polling timeout: ${s.timeoutSeconds} (must not be NaN)`);if(s.timeoutSeconds<5)throw new v(E,`invalid long polling timeout: ${s.timeoutSeconds} (minimum allowed value is 5)`);if(s.timeoutSeconds>30)throw new v(E,`invalid long polling timeout: ${s.timeoutSeconds} (maximum allowed value is 30)`)}}(this.experimentalLongPollingOptions),this.useFetchStreams=!!e.useFetchStreams}isEqual(e){return this.host===e.host&&this.ssl===e.ssl&&this.credentials===e.credentials&&this.cacheSizeBytes===e.cacheSizeBytes&&this.experimentalForceLongPolling===e.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===e.experimentalAutoDetectLongPolling&&function(r,i){return r.timeoutSeconds===i.timeoutSeconds}(this.experimentalLongPollingOptions,e.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===e.ignoreUndefinedProperties&&this.useFetchStreams===e.useFetchStreams}}class Fe{constructor(e,t,r,i){this._authCredentials=e,this._appCheckCredentials=t,this._databaseId=r,this._app=i,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new Cn({}),this._settingsFrozen=!1,this._emulatorOptions={},this._terminateTask="notTerminated"}get app(){if(!this._app)throw new v(ae,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!=="notTerminated"}_setSettings(e){if(this._settingsFrozen)throw new v(ae,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new Cn(e),this._emulatorOptions=e.emulatorOptions||{},e.credentials!==void 0&&(this._authCredentials=function(r){if(!r)return new bs;switch(r.type){case"firstParty":return new Vs(r.sessionIndex||"0",r.iamToken||null,r.authTokenFactory||null);case"provider":return r.client;default:throw new v(E,"makeAuthCredentialsProvider failed due to invalid credential type")}}(e.credentials))}_getSettings(){return this._settings}_getEmulatorOptions(){return this._emulatorOptions}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask==="notTerminated"&&(this._terminateTask=this._terminate()),this._terminateTask}async _restart(){this._terminateTask==="notTerminated"?await this._terminate():this._terminateTask="notTerminated"}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return function(t){const r=be.get(t);r&&(qe(dr,"Removing Datastore"),be.delete(t),r.terminate())}(this),Promise.resolve()}}function Yo(n,e){const t=typeof n=="object"?n:ns(),r=typeof n=="string"?n:"(default)",i=Ji(t,"firestore/lite").getImmediate({identifier:r});if(!i._initialized){const s=xr("firestore");s&&Ao(i,...s)}return i}function Ao(n,e,t,r={}){var i;n=De(n,Fe);const s=Rt(e),o=n._getSettings(),f=Object.assign(Object.assign({},o),{emulatorOptions:n._getEmulatorOptions()}),m=`${e}:${t}`;s&&(Br(`https://${m}`),Ur("Firestore",!0)),o.host!==fr&&o.host!==m&&qn("Host has been set in both settings() and connectFirestoreEmulator(), emulator host will be used.");const g=Object.assign(Object.assign({},o),{host:m,ssl:s,emulatorOptions:r});if(!je(g,f)&&(n._setSettings(g),r.mockUserToken)){let y,w;if(typeof r.mockUserToken=="string")y=r.mockUserToken,w=M.MOCK_USER;else{y=Lr(r.mockUserToken,(i=n._app)===null||i===void 0?void 0:i.options.projectId);const _=r.mockUserToken.sub||r.mockUserToken.user_id;if(!_)throw new v(E,"mockUserToken must contain 'sub' or 'user_id' field!");w=new M(_)}n._authCredentials=new Is(new Gn(y,w))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class re{constructor(e,t,r){this.converter=t,this._query=r,this.type="query",this.firestore=e}withConverter(e){return new re(this.firestore,e,this._query)}}class k{constructor(e,t,r){this.converter=t,this._key=r,this.type="document",this.firestore=e}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new ne(this.firestore,this.converter,this._key.path.popLast())}withConverter(e){return new k(this.firestore,e,this._key)}toJSON(){return{type:k._jsonSchemaVersion,referencePath:this._key.toString()}}static fromJSON(e,t,r){if(Ne(t,k._jsonSchema))return new k(e,r||null,new O(C.fromString(t.referencePath)))}}k._jsonSchemaVersion="firestore/documentReference/1.0",k._jsonSchema={type:U("string",k._jsonSchemaVersion),referencePath:U("string")};class ne extends re{constructor(e,t,r){super(e,t,function(s){return new et(s)}(r)),this._path=r,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){const e=this._path.popLast();return e.isEmpty()?null:new k(this.firestore,null,new O(e))}withConverter(e){return new ne(this.firestore,e,this._path)}}function Xo(n,e,...t){if(n=K(n),Qn("collection","path",e),n instanceof Fe){const r=C.fromString(e,...t);return pn(r),new ne(n,null,r)}{if(!(n instanceof k||n instanceof ne))throw new v(E,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(C.fromString(e,...t));return pn(r),new ne(n.firestore,null,r)}}function Zo(n,e,...t){if(n=K(n),arguments.length===1&&(e=Cs.newId()),Qn("doc","path",e),n instanceof Fe){const r=C.fromString(e,...t);return fn(r),new k(n,null,new O(r))}{if(!(n instanceof k||n instanceof ne))throw new v(E,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(C.fromString(e,...t));return fn(r),new k(n.firestore,n instanceof ne?n.converter:null,new O(r))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class j{constructor(e){this._byteString=e}static fromBase64String(e){try{return new j(X.fromBase64String(e))}catch(t){throw new v(E,"Failed to construct data from Base64 string: "+t)}}static fromUint8Array(e){return new j(X.fromUint8Array(e))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(e){return this._byteString.isEqual(e._byteString)}toJSON(){return{type:j._jsonSchemaVersion,bytes:this.toBase64()}}static fromJSON(e){if(Ne(e,j._jsonSchema))return j.fromBase64String(e.bytes)}}j._jsonSchemaVersion="firestore/bytes/1.0",j._jsonSchema={type:U("string",j._jsonSchemaVersion),bytes:U("string")};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class it{constructor(...e){for(let t=0;t<e.length;++t)if(e[t].length===0)throw new v(E,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new B(e)}isEqual(e){return this._internalPath.isEqual(e._internalPath)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class st{constructor(e){this._methodName=e}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class W{constructor(e,t){if(!isFinite(e)||e<-90||e>90)throw new v(E,"Latitude must be a number between -90 and 90, but was: "+e);if(!isFinite(t)||t<-180||t>180)throw new v(E,"Longitude must be a number between -180 and 180, but was: "+t);this._lat=e,this._long=t}get latitude(){return this._lat}get longitude(){return this._long}isEqual(e){return this._lat===e._lat&&this._long===e._long}_compareTo(e){return S(this._lat,e._lat)||S(this._long,e._long)}toJSON(){return{latitude:this._lat,longitude:this._long,type:W._jsonSchemaVersion}}static fromJSON(e){if(Ne(e,W._jsonSchema))return new W(e.latitude,e.longitude)}}W._jsonSchemaVersion="firestore/geoPoint/1.0",W._jsonSchema={type:U("string",W._jsonSchemaVersion),latitude:U("number"),longitude:U("number")};/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class G{constructor(e){this._values=(e||[]).map(t=>t)}toArray(){return this._values.map(e=>e)}isEqual(e){/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/return function(r,i){if(r.length!==i.length)return!1;for(let s=0;s<r.length;++s)if(r[s]!==i[s])return!1;return!0}(this._values,e._values)}toJSON(){return{type:G._jsonSchemaVersion,vectorValues:this._values}}static fromJSON(e){if(Ne(e,G._jsonSchema)){if(Array.isArray(e.vectorValues)&&e.vectorValues.every(t=>typeof t=="number"))return new G(e.vectorValues);throw new v(E,"Expected 'vectorValues' field to be a number array")}}}G._jsonSchemaVersion="firestore/vectorValue/1.0",G._jsonSchema={type:U("string",G._jsonSchemaVersion),vectorValues:U("object")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Vo=/^__.*__$/;class So{constructor(e,t,r){this.data=e,this.fieldMask=t,this.fieldTransforms=r}toMutation(e,t){return this.fieldMask!==null?new Nt(e,this.data,this.fieldMask,t,this.fieldTransforms):new ar(e,this.data,t,this.fieldTransforms)}}class pr{constructor(e,t,r){this.data=e,this.fieldMask=t,this.fieldTransforms=r}toMutation(e,t){return new Nt(e,this.data,this.fieldMask,t,this.fieldTransforms)}}function mr(n){switch(n){case 0:case 2:case 1:return!0;case 3:case 4:return!1;default:throw R(40011,{it:n})}}class xt{constructor(e,t,r,i,s,o){this.settings=e,this.databaseId=t,this.serializer=r,this.ignoreUndefinedProperties=i,s===void 0&&this.st(),this.fieldTransforms=s||[],this.fieldMask=o||[]}get path(){return this.settings.path}get it(){return this.settings.it}ot(e){return new xt(Object.assign(Object.assign({},this.settings),e),this.databaseId,this.serializer,this.ignoreUndefinedProperties,this.fieldTransforms,this.fieldMask)}ut(e){var t;const r=(t=this.path)===null||t===void 0?void 0:t.child(e),i=this.ot({path:r,_t:!1});return i.ct(e),i}lt(e){var t;const r=(t=this.path)===null||t===void 0?void 0:t.child(e),i=this.ot({path:r,_t:!1});return i.st(),i}ht(e){return this.ot({path:void 0,_t:!0})}ft(e){return Xe(e,this.settings.methodName,this.settings.dt||!1,this.path,this.settings.Et)}contains(e){return this.fieldMask.find(t=>e.isPrefixOf(t))!==void 0||this.fieldTransforms.find(t=>e.isPrefixOf(t.field))!==void 0}st(){if(this.path)for(let e=0;e<this.path.length;e++)this.ct(this.path.get(e))}ct(e){if(e.length===0)throw this.ft("Document fields must not be empty");if(mr(this.it)&&Vo.test(e))throw this.ft('Document fields cannot begin and end with "__"')}}class Po{constructor(e,t,r){this.databaseId=e,this.ignoreUndefinedProperties=t,this.serializer=r||Ft(e)}Tt(e,t,r,i=!1){return new xt({it:e,methodName:t,Et:r,path:B.emptyPath(),_t:!1,dt:i},this.databaseId,this.serializer,this.ignoreUndefinedProperties)}}function Mt(n){const e=n._freezeSettings(),t=Ft(n._databaseId);return new Po(n._databaseId,!!e.ignoreUndefinedProperties,t)}function gr(n,e,t,r,i,s={}){const o=n.Tt(s.merge||s.mergeFields?2:0,e,t,i);Lt("Data must be an object, but it was:",o,r);const f=_r(r,o);let m,g;if(s.merge)m=new ce(o.fieldMask),g=o.fieldTransforms;else if(s.mergeFields){const y=[];for(const w of s.mergeFields){const _=St(e,w,t);if(!o.contains(_))throw new v(E,`Field '${_}' is specified in your field mask but missing from your input data.`);vr(y,_)||y.push(_)}m=new ce(y),g=o.fieldTransforms.filter(w=>m.covers(w.field))}else m=null,g=o.fieldTransforms;return new So(new L(f),m,g)}class ot extends st{_toFieldTransform(e){if(e.it!==2)throw e.it===1?e.ft(`${this._methodName}() can only appear at the top level of your update data`):e.ft(`${this._methodName}() cannot be used with set() unless you pass {merge:true}`);return e.fieldMask.push(e.path),null}isEqual(e){return e instanceof ot}}class Bt extends st{_toFieldTransform(e){return new io(e.path,new or)}isEqual(e){return e instanceof Bt}}function Ro(n,e,t,r){const i=n.Tt(1,e,t);Lt("Data must be an object, but it was:",i,r);const s=[],o=L.empty();ke(r,(m,g)=>{const y=$t(e,m,t);g=K(g);const w=i.lt(y);if(g instanceof ot)s.push(y);else{const _=xe(g,w);_!=null&&(s.push(y),o.set(y,_))}});const f=new ce(s);return new pr(o,f,i.fieldTransforms)}function Co(n,e,t,r,i,s){const o=n.Tt(1,e,t),f=[St(e,r,t)],m=[i];if(s.length%2!=0)throw new v(E,`Function ${e}() needs to be called with an even number of arguments that alternate between field names and values.`);for(let _=0;_<s.length;_+=2)f.push(St(e,s[_])),m.push(s[_+1]);const g=[],y=L.empty();for(let _=f.length-1;_>=0;--_)if(!vr(g,f[_])){const T=f[_];let I=m[_];I=K(I);const P=o.lt(T);if(I instanceof ot)g.push(T);else{const V=xe(I,P);V!=null&&(g.push(T),y.set(T,V))}}const w=new ce(g);return new pr(y,w,o.fieldTransforms)}function Do(n,e,t,r=!1){return xe(t,n.Tt(r?4:3,e))}function xe(n,e){if(yr(n=K(n)))return Lt("Unsupported field value:",e,n),_r(n,e);if(n instanceof st)return function(r,i){if(!mr(i.it))throw i.ft(`${r._methodName}() can only be used with update() and set()`);if(!i.path)throw i.ft(`${r._methodName}() is not currently supported inside arrays`);const s=r._toFieldTransform(i);s&&i.fieldTransforms.push(s)}(n,e),null;if(n===void 0&&e.ignoreUndefinedProperties)return null;if(e.path&&e.fieldMask.push(e.path),n instanceof Array){if(e.settings._t&&e.it!==4)throw e.ft("Nested arrays are not supported");return function(r,i){const s=[];let o=0;for(const f of r){let m=xe(f,i.ht(o));m==null&&(m={nullValue:"NULL_VALUE"}),s.push(m),o++}return{arrayValue:{values:s}}}(n,e)}return function(r,i){if((r=K(r))===null)return{nullValue:"NULL_VALUE"};if(typeof r=="number")return eo(i.serializer,r);if(typeof r=="boolean")return{booleanValue:r};if(typeof r=="string")return{stringValue:r};if(r instanceof Date){const s=N.fromDate(r);return{timestampValue:Tt(i.serializer,s)}}if(r instanceof N){const s=new N(r.seconds,1e3*Math.floor(r.nanoseconds/1e3));return{timestampValue:Tt(i.serializer,s)}}if(r instanceof W)return{geoPointValue:{latitude:r.latitude,longitude:r.longitude}};if(r instanceof j)return{bytesValue:co(i.serializer,r._byteString)};if(r instanceof k){const s=i.databaseId,o=r.firestore._databaseId;if(!o.isEqual(s))throw i.ft(`Document reference is for database ${o.projectId}/${o.database} but should be for database ${s.projectId}/${s.database}`);return{referenceValue:Ot(r.firestore._databaseId||i.databaseId,r._key.path)}}if(r instanceof G)return function(o,f){return{mapValue:{fields:{[er]:{stringValue:tr},[We]:{arrayValue:{values:o.toArray().map(g=>{if(typeof g!="number")throw f.ft("VectorValues must only contain numeric values.");return sr(f.serializer,g)})}}}}}}(r,i);throw i.ft(`Unsupported field value: ${Ze(r)}`)}(n,e)}function _r(n,e){const t={};return function(i){for(const s in i)if(Object.prototype.hasOwnProperty.call(i,s))return!1;return!0}(n)?e.path&&e.path.length>0&&e.fieldMask.push(e.path):ke(n,(r,i)=>{const s=xe(i,e.ut(r));s!=null&&(t[r]=s)}),{mapValue:{fields:t}}}function yr(n){return!(typeof n!="object"||n===null||n instanceof Array||n instanceof Date||n instanceof N||n instanceof W||n instanceof j||n instanceof k||n instanceof st||n instanceof G)}function Lt(n,e,t){if(!yr(t)||!Jn(t)){const r=Ze(t);throw r==="an object"?e.ft(n+" a custom object"):e.ft(n+" "+r)}}function St(n,e,t){if((e=K(e))instanceof it)return e._internalPath;if(typeof e=="string")return $t(n,e);throw Xe("Field path arguments must be of type string or ",n,!1,void 0,t)}const ko=new RegExp("[~\\*/\\[\\]]");function $t(n,e,t){if(e.search(ko)>=0)throw Xe(`Invalid field path (${e}). Paths must not contain '~', '*', '/', '[', or ']'`,n,!1,void 0,t);try{return new it(...e.split("."))._internalPath}catch{throw Xe(`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,n,!1,void 0,t)}}function Xe(n,e,t,r,i){const s=r&&!r.isEmpty(),o=i!==void 0;let f=`Function ${e}() called with invalid data`;t&&(f+=" (via `toFirestore()`)"),f+=". ";let m="";return(s||o)&&(m+=" (found",s&&(m+=` in field ${r}`),o&&(m+=` in document ${i}`),m+=")"),new v(E,f+n+m)}function vr(n,e){return n.some(t=>t.isEqual(e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wr{constructor(e,t,r,i,s){this._firestore=e,this._userDataWriter=t,this._key=r,this._document=i,this._converter=s}get id(){return this._key.path.lastSegment()}get ref(){return new k(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){const e=new Er(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(e)}return this._userDataWriter.convertValue(this._document.data.value)}}get(e){if(this._document){const t=this._document.data.field(br("DocumentSnapshot.get",e));if(t!==null)return this._userDataWriter.convertValue(t)}}}class Er extends wr{data(){return super.data()}}class No{constructor(e,t){this._docs=t,this.query=e}get docs(){return[...this._docs]}get size(){return this.docs.length}get empty(){return this.docs.length===0}forEach(e,t){this._docs.forEach(e,t)}}function br(n,e){return typeof e=="string"?$t(n,e):e instanceof it?e._internalPath:e._delegate._internalPath}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jt{}class Ut extends jt{}function ea(n,e,...t){let r=[];e instanceof jt&&r.push(e),r=r.concat(t),function(s){const o=s.filter(m=>m instanceof qt).length,f=s.filter(m=>m instanceof zt).length;if(o>1||o>0&&f>0)throw new v(E,"InvalidQuery. When using composite filters, you cannot use more than one filter at the top level. Consider nesting the multiple filters within an `and(...)` statement. For example: change `query(query, where(...), or(...))` to `query(query, and(where(...), or(...)))`.")}(r);for(const i of r)n=i._apply(n);return n}class zt extends Ut{constructor(e,t,r){super(),this._field=e,this._op=t,this._value=r,this.type="where"}static _create(e,t,r){return new zt(e,t,r)}_apply(e){const t=this._parse(e);return Ir(e._query,t),new re(e.firestore,e.converter,It(e._query,t))}_parse(e){const t=Mt(e.firestore);return function(s,o,f,m,g,y,w){let _;if(g.isKeyField()){if(y==="array-contains"||y==="array-contains-any")throw new v(E,`Invalid Query. You can't perform '${y}' queries on documentId().`);if(y==="in"||y==="not-in"){kn(w,y);const I=[];for(const P of w)I.push(Dn(m,s,P));_={arrayValue:{values:I}}}else _=Dn(m,s,w)}else y!=="in"&&y!=="not-in"&&y!=="array-contains-any"||kn(w,y),_=Do(f,o,w,y==="in"||y==="not-in");return z.create(g,y,_)}(e._query,"where",t,e.firestore._databaseId,this._field,this._op,this._value)}}class qt extends jt{constructor(e,t){super(),this.type=e,this._queryConstraints=t}static _create(e,t){return new qt(e,t)}_parse(e){const t=this._queryConstraints.map(r=>r._parse(e)).filter(r=>r.getFilters().length>0);return t.length===1?t[0]:Oe.create(t,this._getOperator())}_apply(e){const t=this._parse(e);return t.getFilters().length===0?e:(function(i,s){let o=i;const f=s.getFlattenedFilters();for(const m of f)Ir(o,m),o=It(o,m)}(e._query,t),new re(e.firestore,e.converter,It(e._query,t)))}_getQueryConstraints(){return this._queryConstraints}_getOperator(){return this.type==="and"?"and":"or"}}class Ht extends Ut{constructor(e,t){super(),this._field=e,this._direction=t,this.type="orderBy"}static _create(e,t){return new Ht(e,t)}_apply(e){const t=function(i,s,o){if(i.startAt!==null)throw new v(E,"Invalid query. You must not call startAt() or startAfter() before calling orderBy().");if(i.endAt!==null)throw new v(E,"Invalid query. You must not call endAt() or endBefore() before calling orderBy().");return new Qe(s,o)}(e._query,this._field,this._direction);return new re(e.firestore,e.converter,function(i,s){const o=i.explicitOrderBy.concat([s]);return new et(i.path,i.collectionGroup,o,i.filters.slice(),i.limit,i.limitType,i.startAt,i.endAt)}(e._query,t))}}function ta(n,e="asc"){const t=e,r=br("orderBy",n);return Ht._create(r,t)}class Wt extends Ut{constructor(e,t,r){super(),this.type=e,this._limit=t,this._limitType=r}static _create(e,t,r){return new Wt(e,t,r)}_apply(e){return new re(e.firestore,e.converter,function(r,i,s){return new et(r.path,r.collectionGroup,r.explicitOrderBy.slice(),r.filters.slice(),i,s,r.startAt,r.endAt)}(e._query,this._limit,this._limitType))}}function na(n){return Ns("limit",n),Wt._create("limit",n,"F")}function Dn(n,e,t){if(typeof(t=K(t))=="string"){if(t==="")throw new v(E,"Invalid query. When querying with documentId(), you must provide a valid document ID, but it was an empty string.");if(!Js(e)&&t.indexOf("/")!==-1)throw new v(E,`Invalid query. When querying a collection by documentId(), you must provide a plain document ID, but '${t}' contains a '/' character.`);const r=e.path.child(C.fromString(t));if(!O.isDocumentKey(r))throw new v(E,`Invalid query. When querying a collection group by documentId(), the value provided must result in a valid document path, but '${r}' is not because it has an odd number of segments (${r.length}).`);return bn(n,new O(r))}if(t instanceof k)return bn(n,t._key);throw new v(E,`Invalid query. When querying with documentId(), you must provide a valid string or a DocumentReference, but it was: ${Ze(t)}.`)}function kn(n,e){if(!Array.isArray(n)||n.length===0)throw new v(E,`Invalid Query. A non-empty array is required for '${e.toString()}' filters.`)}function Ir(n,e){const t=function(i,s){for(const o of i)for(const f of o.getFlattenedFilters())if(s.indexOf(f.op)>=0)return f.op;return null}(n.filters,function(i){switch(i){case"!=":return["!=","not-in"];case"array-contains-any":case"in":return["not-in"];case"not-in":return["array-contains-any","in","not-in","!="];default:return[]}}(e.op));if(t!==null)throw t===e.op?new v(E,`Invalid query. You cannot use more than one '${e.op.toString()}' filter.`):new v(E,`Invalid query. You cannot use '${e.op.toString()}' filters with '${t.toString()}' filters.`)}class Oo{convertValue(e,t="none"){switch(le(e)){case 0:return null;case 1:return e.booleanValue;case 2:return D(e.integerValue||e.doubleValue);case 3:return this.convertTimestamp(e.timestampValue);case 4:return this.convertServerTimestamp(e,t);case 5:return e.stringValue;case 6:return this.convertBytes(Ve(e.bytesValue));case 7:return this.convertReference(e.referenceValue);case 8:return this.convertGeoPoint(e.geoPointValue);case 9:return this.convertArray(e.arrayValue,t);case 11:return this.convertObject(e.mapValue,t);case 10:return this.convertVectorValue(e.mapValue);default:throw R(62114,{value:e})}}convertObject(e,t){return this.convertObjectMap(e.fields,t)}convertObjectMap(e,t="none"){const r={};return ke(e,(i,s)=>{r[i]=this.convertValue(s,t)}),r}convertVectorValue(e){var t,r,i;const s=(i=(r=(t=e.fields)===null||t===void 0?void 0:t[We].arrayValue)===null||r===void 0?void 0:r.values)===null||i===void 0?void 0:i.map(o=>D(o.doubleValue));return new G(s)}convertGeoPoint(e){return new W(D(e.latitude),D(e.longitude))}convertArray(e,t){return(e.values||[]).map(r=>this.convertValue(r,t))}convertServerTimestamp(e,t){switch(t){case"previous":const r=Zn(e);return r==null?null:this.convertValue(r,t);case"estimate":return this.convertTimestamp(Se(e));default:return null}}convertTimestamp(e){const t=ue(e);return new N(t.seconds,t.nanos)}convertDocumentKey(e,t){const r=C.fromString(e);$(cr(r),9688,{name:e});const i=new Ae(r.get(1),r.get(3)),s=new O(r.popFirst(5));return i.isEqual(t)||Dt(`Document ${s} contains a document reference within a different database (${i.projectId}/${i.database}) which is not supported. It will be treated as a reference in the current database (${t.projectId}/${t.database}) instead.`),s}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Tr(n,e,t){let r;return r=n?t&&(t.merge||t.mergeFields)?n.toFirestore(e,t):n.toFirestore(e):e,r}class Ar extends Oo{constructor(e){super(),this.firestore=e}convertBytes(e){return new j(e)}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return new k(this.firestore,null,t)}}function ra(n){const e=rt((n=De(n,k)).firestore),t=new Ar(n.firestore);return bo(e,[n._key]).then(r=>{$(r.length===1,15618);const i=r[0];return new wr(n.firestore,t,n._key,i.isFoundDocument()?i:null,n.converter)})}function ia(n){(function(i){if(i.limitType==="L"&&i.explicitOrderBy.length===0)throw new v(Wn,"limitToLast() queries require specifying at least one orderBy() clause")})((n=De(n,re))._query);const e=rt(n.firestore),t=new Ar(n.firestore);return Io(e,n._query).then(r=>{const i=r.map(s=>new Er(n.firestore,t,s.key,s,n.converter));return n._query.limitType==="L"&&i.reverse(),new No(n,i)})}function sa(n,e,t){const r=Tr((n=De(n,k)).converter,e,t),i=gr(Mt(n.firestore),"setDoc",n._key,r,n.converter!==null,t);return hr(rt(n.firestore),[i.toMutation(n._key,te.none())])}function oa(){return new Bt("serverTimestamp")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Fo{constructor(e,t){this._firestore=e,this._commitHandler=t,this._mutations=[],this._committed=!1,this._dataReader=Mt(e)}set(e,t,r){this._verifyNotCommitted();const i=pt(e,this._firestore),s=Tr(i.converter,t,r),o=gr(this._dataReader,"WriteBatch.set",i._key,s,i.converter!==null,r);return this._mutations.push(o.toMutation(i._key,te.none())),this}update(e,t,r,...i){this._verifyNotCommitted();const s=pt(e,this._firestore);let o;return o=typeof(t=K(t))=="string"||t instanceof it?Co(this._dataReader,"WriteBatch.update",s._key,t,r,i):Ro(this._dataReader,"WriteBatch.update",s._key,t),this._mutations.push(o.toMutation(s._key,te.exists(!0))),this}delete(e){this._verifyNotCommitted();const t=pt(e,this._firestore);return this._mutations=this._mutations.concat(new ur(t._key,te.none())),this}commit(){return this._verifyNotCommitted(),this._committed=!0,this._mutations.length>0?this._commitHandler(this._mutations):Promise.resolve()}_verifyNotCommitted(){if(this._committed)throw new v(ae,"A write batch can no longer be used after commit() has been called.")}}function pt(n,e){if((n=K(n)).firestore!==e)throw new v(E,"Provided document reference is from a different Firestore instance.");return n}function aa(n){const e=rt(n=De(n,Fe));return new Fo(n,t=>hr(e,t))}(function(){(function(t){_e=t})(`${es}_lite`),ze(new Ie("firestore/lite",(e,{instanceIdentifier:t,options:r})=>{const i=e.getProvider("app").getImmediate(),s=new Fe(new Ts(e.getProvider("auth-internal")),new Ss(i,e.getProvider("app-check-internal")),function(f,m){if(!Object.prototype.hasOwnProperty.apply(f.options,["projectId"]))throw new v(E,'"projectId" not provided in firebase.initializeApp.');return new Ae(f.options.projectId,m)}(i,t),i);return r&&s._setSettings(r),s},"PUBLIC").setMultipleInstances(!0)),pe("firestore-lite",un,""),pe("firestore-lite",un,"esm2017")})();var xo="firebase",Mo="11.10.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */pe(xo,Mo,"app");export{qo as A,Cr as B,A as C,Lo as D,Mn as E,ge as F,Uo as G,jo as H,$o as I,ze as J,Ie as K,Bn as L,pe as M,Ko as N,Mr as O,Dr as P,Qo as Q,zr as R,es as S,On as T,Yi as _,ra as a,ia as b,Xo as c,Zo as d,sa as e,Wo as f,Yo as g,Go as h,ts as i,Ho as j,K as k,na as l,je as m,Rt as n,ta as o,Br as p,ea as q,Ji as r,oa as s,Bo as t,Ur as u,Fr as v,aa as w,ns as x,xn as y,zo as z};

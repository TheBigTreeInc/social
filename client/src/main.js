import {sendBugReport} from './bug-report.js';
import {createDiagnosticEvents,classifyFetchFailure,diagnosticsQuickSummary} from './diagnostic-events.js';
import {loadBundledCatalog,verifyBundledExtension,createExtensionStore,extensionStorageScope} from './extensions/store.js';
import {extensionAssetUrl,validateExtensionManifest} from './extensions/contract.js';
import {extensionUpdateStatus,extensionUpdateSummary,releaseRevision} from './extensions/updates.js';
import {alternativeRelease,migrationEligibility,marketplaceRows} from './extensions/marketplace.js';
import {createExtensionHost,CORE_WALLET_ID} from './extensions/host.js';
import {verifyReviewedCompanion,REVIEWED_COMPANION} from './extensions/reviewed-companion.js';
import {readCompanionPreview,clearCompanionPreview} from './extensions/companion-preview.js';
import {coreWalletFromBundle,filterOptionalApps,goldStatusLabel} from './wallet/core-ui.js';
import {ATRIUM_EXTENSION_ID,isOfficialAtriumSource} from './extensions/game-launch.js';
import {FIRST_PARTY_REPOSITORIES,TAVIX_REPOSITORY_URL,LEGACY_ATRIUM_REPOSITORY_URL,createRepositorySubscriptions,fetchRepository,fetchServerRepositories,mergeRepositoryEntries,extensionSource,remoteOrigin} from './extensions/repositories.js';
import {atriumLauncher,reviewedAtriumBase} from './atrium-launch.js';
import {menuApplications,appGlyph,uiGlyph,extensionIconUrl,BUNDLED_COMPANION_ID} from './launcher.js';
import './style.css';
import './ui/design-tokens.css';
import './ui/components.css';
import './ui/settings.css';
import {hostToolbar,homeToolbar,mobileTabs} from './ui/shell.js';
import {buddyGroups,conversationThreads} from './ui/messenger-model.js';
import {applyInboxFilter} from './ui/message-inbox.js';
import {composerState,messageLimit,messageReceipt} from './message-ui.js';
import {uiHeader} from './ui/components.js';
import {renderSettings,settingsPageTitle} from './ui/settings-view.js';
import {extensionPanelUrl} from './ui/companion-world-entry.js';
import {wireAppPages,wireElasticScroll} from './ui/touch-navigation.js';
import {decideHostBack,shouldDismissKeyboard} from './ui/navigation-policy.js';
import {wireExclusiveMenus} from './ui/menu-controller.js';
import {checkTaviRelease,RELEASES_URL} from './release-updates.js';
import {LooprdSocial,discoverGames,discoverAtriumGames,discoverSocial,loginSocial,registerSocial,recoverSocial,componentPath,gameActivity,newTurnKeys} from './protocol.js';
import {readConfig,writeConfig,selectServerGames,seenStorageKey,previousTurnKeys} from './persistence.js';
import {createDeviceSessionStore} from './device-session.js';
import {classifySessionFailure,createSessionRetry} from './session-recovery.js';
import {grantNotifications,notificationPermissionStatus,sendTestNotification,notifyTurn,notifyChat,notifyFriendRequest} from './notifications.js';
import {pushPreferencesKey,readPushPreferences,savePushPreferences,parsePushCapabilities,pushReadiness} from './push-readiness.js';
import {createResumeSync} from './resume-sync.js';
import {createPushWakeupBridge} from './push-bridge.js';
import {createWakeCoordinator} from './sync-coordinator.js';
import {readStateKey,loadChatReadState,saveChatReadState,reconcileDirectFeed,acknowledgeDirectFeed,chatPollPeers,reconcileConversationSummary,notificationPrefsKey,loadNotificationPrefs,saveNotificationPrefs} from './message-state.js';
import {isTauri,invoke} from '@tauri-apps/api/core';
import {WebviewWindow} from '@tauri-apps/api/webviewWindow';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {PhysicalPosition} from '@tauri-apps/api/dpi';
import {listen, emitTo} from '@tauri-apps/api/event';
import {isValidChatPeer,chatWindowLabel} from './native-windows.js';
import {isValidMatchRoom,matchWindowLabel} from './match-windows.js';
import {openUrl} from '@tauri-apps/plugin-opener';
import {onBackButtonPress} from '@tauri-apps/api/app';
import {newCompanion,loadCompanion,saveCompanion,storageKey,tickCompanion,performCare,changeMode,selectCompanion,updatePreferences,dismissSuggestion} from './companions/engine.js';
import {companionPanel,companionBadge,petSprite} from './companions/view.js';
import {petById} from './companions/catalog.js';
import {createSurfaceRegistry,safeSurfaceId} from './surfaces.js';
import {canShowFloating,parsePetWindowCommand,normalizePetPosition,petWindowSnapshot,PET_WINDOW_LABEL,PET_SIZE} from './companions/native.js';

const CLIENT_VERSION='0.3.111';
const app=document.getElementById('app');
const nativeDesktop=isTauri() && !/Android|iPad|iPhone/i.test(navigator.userAgent);
const clientPlatform=nativeDesktop?'windows':isTauri()&&/Android/i.test(navigator.userAgent)?'android':'web';
// Desktop includes Linux/macOS; the floating native window is Windows-only in this pass.
const nativeWindowsPet=nativeDesktop && /Windows/i.test(navigator.userAgent);
const sessionStore=createDeviceSessionStore({windows:nativeDesktop&&/Windows/i.test(navigator.userAgent),invoke,local:localStorage,session:sessionStorage});
if(nativeDesktop&&document.documentElement?.classList)document.documentElement.classList.add('native-shell');
if(isTauri() && /Android/i.test(navigator.userAgent) && document.documentElement?.classList)document.documentElement.classList.add('android-shell');
// Touch input is not guaranteed to advertise (pointer: coarse) in embedded WebViews.
// Keep compact mouse rows, but make real touch devices opt into accessible hit targets.
if(document.documentElement?.dataset){
 const hasTouchInput=(Number(navigator.maxTouchPoints)||0)>0 || Boolean(window.matchMedia?.('(any-pointer: coarse)').matches);
 document.documentElement.dataset.touch=hasTouchInput?'true':'false';
}
const config=readConfig();
function normalizeTheme(value){return value==='dark'?'dark':'light';}
function applyTheme(){if(document.documentElement?.dataset)document.documentElement.dataset.theme=normalizeTheme(config.theme);}
const surfaces=createSurfaceRegistry();
const nativeChildLabels=new Set();
const state={companion:newCompanion(),companionKey:null,recoverySupported:false,recoveryCodes:null,recoveryMessage:'',authError:'',reportStatus:'',reportStage:'login',reportCode:'LOGIN_FAILED',reportSending:false,friendError:'',api:null,profile:null,revision:0,connected:false,serverStatus:'',serverSupportsAccounts:false,
  goldAmount:null,goldStatus:'loading',goldLastCheckedAt:0,step:'server',authTab:'register',panel:'home',peer:'lobby',contacts:[],lobby:[],direct:[],
  interactions:[],interactionError:'',selectedInteraction:null,inboxFilter:'open',turns:[],gameErrors:{},catalog:[],catalogError:'',atriumGames:[],atriumDiscoveryStatus:'not_connected',lastCatalogAt:0,gameTokens:new Map(),toast:'',mute:false,draft:'',selectedGame:'',avatarCode:'',busy:false,
  sessionRemembered:false,retryAvailable:false,retryOrigin:'',developerAllowed:false,developerVisible:false,developerInfo:null,developerError:'',lastSyncAt:null,pulseState:'disconnected',mobileRoster:true,restoring:false,chatRead:{},unread:{},peerFeeds:new Map(),chatOffset:0,conversationSummaries:[],summarySupported:null,pendingAcks:new Map(),peerReceipts:new Map(),pendingRequestIds:null,notifyPrefs:{messages:true,preview:false,requests:true},pushPrefs:{backgroundEnabled:false},pushCapability:null,pushPermission:'unknown',atriumUrl:null,gameRooms:[],selectedRoomId:null,roomMessages:[],roomError:'',roomDraft:'',theme:normalizeTheme(config.theme),settingsPage:'root',settingsExpanded:{chat:false,push:false},rosterGroups:{online:true,offline:true,requests:true,pending:true,conversations:true},messageFilter:'all',messageSearch:''};
let poll=null,pulse=null,connecting=false,polling=false,toastTimer=null;
let extensionCatalog=[],coreWalletEntry=null,extensionCatalogError='',extensionStore=null,extensionStoreScope='',extensionSelected='',extensionBusy=false;
let extensionInstallApproval=null,extensionSwitchApproval=null;
let extensionDiscoveredCatalog=[];
let marketplaceQuery='',marketplaceFilter='all',marketplaceSelected='';
let extensionVerified=new Set();
let extensionSuggested=[],extensionRepoStatuses=[],extensionRepoLoad=0;
let extensionLastCheckedAt=0,extensionStaleSources=new Set(),extensionUpdatePoll=null;
const EXTENSION_CHECK_INTERVAL=15*60*1000;
const diagnosticEvents=createDiagnosticEvents();
let repositoryChecks=[];
// A sandboxed Atrium iframe can only *request* a Life launch. Tavi owns the
// final browser click; a postMessage never inherits a gesture or game credential.
let pendingLifeLaunch=null;
function clearPendingLifeLaunch(){pendingLifeLaunch=null;document.querySelector('#tavi-life-launch-confirmation')?.remove();}
function offerLifeLaunch(launch,caller){
 if(state.panel!=='extension'||!state.api||!state.profile||extensionSelected!==ATRIUM_EXTENSION_ID||!extensionAccountStore()?.enabled(ATRIUM_EXTENSION_ID)||!isOfficialAtriumSource(extensionAccountStore()?.source(ATRIUM_EXTENSION_ID))||caller.scope!==extensionStoreScope||caller.extensionId!==ATRIUM_EXTENSION_ID||caller.source!==extensionAccountStore()?.source(ATRIUM_EXTENSION_ID))throw Error('Atrium session no longer active');
 if(pendingLifeLaunch)throw Error('A Life launch is already awaiting your approval');
 pendingLifeLaunch={launch,caller,server:state.api.origin,account:state.profile.profileId};
 presentPendingLifeLaunch();
 return {awaitingApproval:true};
}
function presentPendingLifeLaunch(){
 document.querySelector('#tavi-life-launch-confirmation')?.remove();
 if(!pendingLifeLaunch||state.panel!=='extension')return;
 const toolbar=document.querySelector('.tavi-extension-toolbar');if(!toolbar){pendingLifeLaunch=null;return;}
 const {launch}=pendingLifeLaunch;
 const panel=document.createElement('div');panel.id='tavi-life-launch-confirmation';panel.className='tavi-life-launch-confirmation';panel.setAttribute('role','group');panel.setAttribute('aria-label','Confirm external Life launch');
 const detail=document.createElement('span');detail.textContent=`Atrium requests opening Life at ${launch.origin} (match ${launch.matchId}). No sign-in token is shared.`;
 const link=document.createElement('a');link.textContent='Open Life ↗';link.href=launch.url;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('data-life-launch-approve','');
 link.addEventListener('click',event=>{
  const p=pendingLifeLaunch;
  if(!p||p.launch!==launch||state.panel!=='extension'||extensionSelected!==p.caller.extensionId||state.api?.origin!==p.server||state.profile?.profileId!==p.account||!extensionAccountStore()?.enabled(ATRIUM_EXTENSION_ID)||!isOfficialAtriumSource(extensionAccountStore()?.source(ATRIUM_EXTENSION_ID))||p.caller.source!==extensionAccountStore()?.source(ATRIUM_EXTENSION_ID)){event.preventDefault();clearPendingLifeLaunch();toast('Life launch expired. Reopen it from Atrium.');return;}
  // The user clicked Tavi's own control, so browsers can open without popups
  // and Tauri invokes its approved external opener instead of iframe navigation.
  if(isTauri()){event.preventDefault();void openUrl(launch.url).catch(e=>toast('Unable to open Life: '+String(e)));}
  clearPendingLifeLaunch();
 });
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.setAttribute('data-life-launch-cancel','');cancel.addEventListener('click',clearPendingLifeLaunch);
 panel.append(detail,link,cancel);toolbar.after(panel);
}
const walletMethods={
 'wallet.balance':api=>api.walletBalance(),
 'wallet.transactions':(api,p)=>api.walletTransactions(p.limit===undefined?40:p.limit),
 'wallet.claim':(api,p)=>api.walletClaim(p.requestId),
 'wallet.convert':(api,p)=>api.walletConvert(p.from,p.to,p.amount,p.requestId,p.expectedNumerator,p.expectedDenominator),
 'wallet.purchase':(api,p)=>api.walletPurchase(p.sku,p.requestId,p.expectedPrice,p.expectedCurrency,p.expectedMerchant),
 'wallet.orderStatus':(api,p)=>api.walletOrderStatus(p.orderId)
};
const extensionReturnsHome=id=>id===CORE_WALLET_ID||id===BUNDLED_COMPANION_ID;
const extensionHost=createExtensionHost({storage:localStorage,notify:message=>toast(message),
 onCompanionPreview:(_preview,scope)=>{if(scope===extensionStoreScope&&(state.panel==='home'||state.panel==='messenger'))render();},
 isReviewedCompanionSession:current=>!!state.api&&!!state.profile&&current.id===BUNDLED_COMPANION_ID&&current.scope===extensionStoreScope&&current.source==='tavi:bundled'&&current.reviewedBundle===REVIEWED_COMPANION.sha256&&extensionVerified.has(BUNDLED_COMPANION_ID)&&!!extensionAccountStore()?.enabled(BUNDLED_COMPANION_ID)&&extensionAccountStore()?.source(BUNDLED_COMPANION_ID)==='tavi:bundled'&&extensionCatalog.some(e=>e.manifest.id===BUNDLED_COMPANION_ID&&e.manifest.version===REVIEWED_COMPANION.version&&!e.remote),
 close:()=>{clearPendingLifeLaunch();state.panel=extensionReturnsHome(extensionSelected)?'home':'app-store';state.mobileRoster=state.panel==='home';render();},onGameLaunch:offerLifeLaunch,
 walletApi:async (method,params)=>{
  if(!state.connected||!state.api||!state.profile)throw Error('Sign in to use Wallet');
  const run=walletMethods[method];if(!run)throw Error('Unsupported Wallet operation');
  const answer=await run(state.api,params);
  if(method!=='wallet.balance'&&method!=='wallet.transactions'&&method!=='wallet.orderStatus')void refreshGoldBalance(state.api);
  return answer;
 }});
const extensionBase=()=>new URL('./',document.baseURI);
const optionalCatalog=()=>filterOptionalApps(extensionCatalog);
const optionalUpdateSummary=(entries,store,options)=>{
 const result=extensionUpdateSummary(filterOptionalApps(entries),store,options);
 return {...result,missing:result.missing.filter(x=>x.id!==CORE_WALLET_ID)};
};
const extensionEntry=id=>id===CORE_WALLET_ID?coreWalletEntry:extensionCatalog.find(e=>e.manifest.id===id);
const extensionEnabled=id=>id===CORE_WALLET_ID?!!coreWalletEntry:!!extensionAccountStore()?.enabled(id);
// The core Wallet is trusted only from Tavi's own bundled catalog, never a remote
// repository or a per-user extension-install record.
async function ensureCoreWallet(){
 if(!state.api||!state.profile)throw Error('Sign in to use Wallet');
 if(!coreWalletEntry){
  const bundled=await loadBundledCatalog({baseUrl:extensionBase()});
  coreWalletEntry=coreWalletFromBundle(bundled);
 }
 if(!coreWalletEntry)throw Error('The bundled Wallet is missing from this Tavi build');
 if(!extensionVerified.has(CORE_WALLET_ID)){
  await verifyBundledExtension(coreWalletEntry,{baseUrl:extensionBase()});
  extensionVerified.add(CORE_WALLET_ID);
 }
 return coreWalletEntry;
}
async function openCoreWallet(){
 try{await ensureCoreWallet();clearPendingLifeLaunch();extensionSelected=CORE_WALLET_ID;state.panel='extension';state.mobileRoster=false;render();}
 catch(error){toast('Wallet unavailable: '+error.message);}
}
async function refreshGoldBalance(api=state.api){
 if(!api||!state.profile)return;
 const account=state.profile.profileId;
 try{
  const response=await api.walletBalance();
  if(api!==state.api||state.profile?.profileId!==account)return;
  const status=goldStatusLabel(response);
  state.goldAmount=status?.amount??null;
  state.goldStatus=status?'available':'unavailable';
 }catch(error){
  if(api!==state.api||state.profile?.profileId!==account)return;
  state.goldAmount=null;state.goldStatus='unavailable';
 }
 state.goldLastCheckedAt=Date.now();
 if(state.panel==='home'||state.panel==='messenger')render();
}

function extensionAccountStore(){
 const scope=state.api&&state.profile?extensionStorageScope(state.api.origin,state.profile.profileId):null;
 if(!scope)return null;
 if(scope!==extensionStoreScope){extensionStoreScope=scope;extensionStore=createExtensionStore({storage:localStorage,scope});extensionVerified=new Set();}
 return extensionStore;
}
function extensionRepoSubscriptions(){
 if(!state.api?.origin)return null;
 return createRepositorySubscriptions({storage:localStorage,serverOrigin:state.api.origin});
}
async function loadExtensionStore({manual=false}={}){
 const origin=state.api?.origin;
 if(!origin)return;
 const generation=++extensionRepoLoad;
 const previousCatalog=extensionCatalog;
 extensionCatalogError='';extensionRepoStatuses=[];repositoryChecks=[];
 const stale=new Set();
 let bundled=[];
 try{bundled=await loadBundledCatalog({baseUrl:extensionBase()});coreWalletEntry=coreWalletFromBundle(bundled);}
 catch(error){extensionCatalogError='Bundled catalog: '+error.message;diagnosticEvents.record({area:'extension',operation:'bundled_catalog',...classifyFetchFailure(error)});}
 let suggested=[];
 try{suggested=await fetchServerRepositories(origin);diagnosticEvents.record({area:'repository',operation:'server_recommendations',result:'ok'});}catch(error){extensionRepoStatuses.push('Server recommendations: '+error.message);diagnosticEvents.record({area:'repository',operation:'server_recommendations',...classifyFetchFailure(error)});}
 const subscribed=extensionRepoSubscriptions()?.list()||[];
 // Preserve old Atrium installations without contacting the legacy catalog on
 // every new account. The old source is consulted only for installed pins or
 // when the user explicitly subscribed to it.
 const legacyPinned=extensionAccountStore()?.listInstalled()?.some(x=>x.source===LEGACY_ATRIUM_REPOSITORY_URL);
 const all=[...new Set([...FIRST_PARTY_REPOSITORIES,...(legacyPinned?[LEGACY_ATRIUM_REPOSITORY_URL]:[]),...subscribed,...suggested])].slice(0,24);
 const collections=await Promise.all(all.map(async url=>{
  try{const entries=await fetchRepository(url);repositoryChecks.push({source:url===TAVIX_REPOSITORY_URL?'first_party_tavix':url===LEGACY_ATRIUM_REPOSITORY_URL?'first_party_atrium':subscribed.includes(url)?'user_subscription':'server_suggestion',result:'ok',entryCount:entries.length});diagnosticEvents.record({area:'repository',operation:'fetch_index',result:'ok'});return entries;}
  catch(error){const classified=classifyFetchFailure(error);repositoryChecks.push({source:url===TAVIX_REPOSITORY_URL?'first_party_tavix':url===LEGACY_ATRIUM_REPOSITORY_URL?'first_party_atrium':subscribed.includes(url)?'user_subscription':'server_suggestion',result:classified.result,...(classified.status?{httpStatus:classified.status}:{})});diagnosticEvents.record({area:'repository',operation:'fetch_index',...classified});extensionRepoStatuses.push(`${url}: ${error.message}`);stale.add(url);return previousCatalog.filter(entry=>entry.repositoryUrl===url);}
 }));
 if(generation!==extensionRepoLoad||state.api?.origin!==origin)return;
 extensionSuggested=suggested;
 extensionStaleSources=stale;
 extensionDiscoveredCatalog=[...bundled,...collections.flat()];
 extensionSwitchApproval=null;
 extensionCatalog=mergeRepositoryEntries(bundled,collections,{store:extensionAccountStore(),hostedOptionalIds:[BUNDLED_COMPANION_ID]});
 // A saved profile thumbnail becomes visible only after source metadata and
 // all bundled bytes have been checked against the reviewed 0.6.27 pin.
 extensionVerified.delete(BUNDLED_COMPANION_ID);
 const reviewed=extensionCatalog.find(e=>e.manifest.id===BUNDLED_COMPANION_ID&&!e.remote);
 const installed=extensionAccountStore();
 if(reviewed&&installed?.enabled(BUNDLED_COMPANION_ID)&&installed.source(BUNDLED_COMPANION_ID)==='tavi:bundled'&&extensionUpdateStatus(reviewed,installed)==='current'){
  try{await verifyReviewedCompanion(reviewed);await verifyBundledExtension(reviewed,{baseUrl:extensionBase()});if(generation!==extensionRepoLoad||state.api?.origin!==origin||installed!==extensionAccountStore())return;extensionVerified.add(BUNDLED_COMPANION_ID);}
  catch(error){diagnosticEvents.record({area:'extension',operation:'companion_review',result:'failed'});}
 }
 extensionLastCheckedAt=Date.now();
 const summary=optionalUpdateSummary(extensionCatalog,extensionAccountStore(),{staleSources:stale});
 if(manual)toast(stale.size?`Checked extensions: ${summary.count} update(s) found; ${stale.size} repository check(s) failed.`:summary.count?`${summary.count} extension update(s) available.`:'Extensions are up to date.');
 else render();
}
async function addExtensionRepository(form){
 const url=new FormData(form).get('repository');
 try{
  // Validate and fetch first. A broken repository is not subscribed.
  await fetchRepository(String(url));
  extensionRepoSubscriptions()?.add(String(url));
  await loadExtensionStore();toast('Repository added. Extensions are available to install.');
 }catch(error){toast('Repository not added: '+error.message);}
}
function alternateStoreRelease(entry){return alternativeRelease(entry,extensionDiscoveredCatalog,extensionAccountStore(),{staleSources:extensionStaleSources});}
function storeSourceLabel(source){return source==='tavi:bundled'?'Bundled with Tavi':source===TAVIX_REPOSITORY_URL?'Official TaviX repository':source===LEGACY_ATRIUM_REPOSITORY_URL?'Atrium legacy catalog':'Community repository';}
function marketplaceItemActions(entry,{detailed=false}={}){
 const m=entry.manifest,store=extensionAccountStore(),installed=store?.installed(m.id),enabled=store?.enabled(m.id);
 const status=extensionUpdateStatus(entry,store),alt=alternateStoreRelease(entry);
 const compatible=validateExtensionManifest(m).compatible&&(!m.platforms||m.platforms.includes(clientPlatform));
 const stale=entry.repositoryUrl&&extensionStaleSources.has(entry.repositoryUrl);
 const blocked=['source-changed','published-older','unknown'].includes(status)||stale;
 return `${!compatible?'<span class="tavi-marketplace-unavailable">Not compatible</span>':blocked?'':enabled&&status!=='update-available'?`<button type="button" data-extension-open="${esc(m.id)}">Open</button>`:installed&&status!=='update-available'?`<button type="button" data-extension-enable="${esc(m.id)}">Enable</button>`:`<button type="button" data-extension-install="${esc(m.id)}" ${extensionBusy?'disabled':''}>${status==='update-available'?'Update':'Install'}</button>`}${alt&&compatible?`<button type="button" class="tavi-marketplace-review" data-extension-switch="${esc(m.id)}">Review</button>`:''}${detailed&&installed?`${enabled?`<button type="button" data-extension-disable="${esc(m.id)}">Disable</button>`:''}<button type="button" data-extension-remove="${esc(m.id)}">Remove</button>`:''}`;
}
function marketplaceCard({entry,installed,alternative}){
 const m=entry.manifest;
 let iconSrc=null;try{iconSrc=extensionIconUrl(entry,extensionBase());}catch{}
 const current=installed?extensionAccountStore()?.version(m.id):null;
 const status=extensionUpdateStatus(entry,extensionAccountStore());
 const update=alternative?`New ${alternative.manifest.version} from TaviX`:status==='update-available'?`Update ${m.version} available`:installed?`Installed ${current}`:`${m.version} · ${storeSourceLabel(extensionSource(entry))}`;
 const keywords=[m.name,m.publisher,m.summary,m.id].join(' ').toLocaleLowerCase();
 return `<article class="tavi-store-item tavi-marketplace-item" data-marketplace-installed="${installed?'true':'false'}" data-marketplace-update="${alternative||status==='update-available'?'true':'false'}" data-marketplace-search="${esc(keywords)}"><span class="tavi-store-icon tone-forest" aria-hidden="true">${appGlyph(m.id===ATRIUM_EXTENSION_ID?'atrium':'extension')}${iconSrc?`<img src="${esc(iconSrc)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}</span><button type="button" class="tavi-marketplace-copy" data-extension-details="${esc(m.id)}" aria-label="Details for ${esc(m.name)}"><strong>${esc(m.name)}</strong><small>${esc(update)}</small></button><div class="tavi-store-actions">${marketplaceItemActions(entry)}</div></article>`;
}
function marketplaceDetail(entry){
 const m=entry.manifest,store=extensionAccountStore(),installed=store?.installed(m.id),alt=alternateStoreRelease(entry),status=extensionUpdateStatus(entry,store);
 const source=extensionSource(entry);const remote=entry.remote;
 return `<section class="tavi-marketplace-details"><button class="tavi-marketplace-return" data-marketplace-back type="button">${uiGlyph('back')} All apps</button><h2>${esc(m.name)}</h2><p>${esc(m.summary)}</p><p class="tavi-marketplace-meta">${esc(m.publisher)} · ${esc(m.version)} · ${esc(storeSourceLabel(source))}</p>${installed?`<p>Installed ${esc(store.version(m.id)||'unknown')} · ${esc(status==='current'?'Current at pinned source':status==='update-available'?'Update available':status)}</p>`:''}${alt?`<p class="tavi-marketplace-alt"><strong>Different source offers ${esc(alt.manifest.version)}</strong><span>Published by ${esc(alt.manifest.publisher)} through the central TaviX catalog. Source switching is not automatic.</span></p>`:''}<div class="tavi-marketplace-detail-actions">${marketplaceItemActions(entry,{detailed:true})}</div><h3>Access and publisher</h3><dl><dt>Permissions</dt><dd>${esc(m.permissions.join(', ')||'None')}</dd><dt>Publisher</dt><dd>${esc(m.publisher)}</dd><dt>Current source</dt><dd>${esc(source)}</dd>${remote?`<dt>Source code</dt><dd><a href="${esc(remote.source)}" rel="noopener noreferrer" target="_blank">Publisher repository</a></dd><dt>License</dt><dd>${esc(remote.license)}</dd>`:''}</dl><p class="fineprint">Tavi keeps your account credentials outside extensions. App state is separate from the publisher's hosted code.</p></section>`;
}
function appStorePanel(){
 const store=extensionAccountStore(),subscriptions=extensionRepoSubscriptions()?.list()||[];
 const summary=optionalUpdateSummary(extensionCatalog,store,{staleSources:extensionStaleSources});
 const rows=marketplaceRows(optionalCatalog(),store,extensionDiscoveredCatalog,{staleSources:extensionStaleSources});
 const alternativeCount=rows.filter(r=>r.alternative).length;
 const offers=rows.filter(r=>r.alternative||extensionUpdateStatus(r.entry,store)==='update-available').length;
 const when=extensionLastCheckedAt?new Date(extensionLastCheckedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'Not checked yet';
 const detail=rows.find(row=>row.entry.manifest.id===marketplaceSelected);
 return `<section class="utility tavi-app-store tavi-marketplace" aria-label="App Store">
 <header class="tavi-marketplace-header"><h2>Discover apps</h2><button type="button" data-action="store-refresh" class="tavi-marketplace-refresh" aria-label="Check for app updates" title="Check for updates">${uiGlyph('refresh')}<span class="sr-only">Check for updates</span></button><button type="button" class="tavi-marketplace-manage" data-marketplace-manage aria-label="Manage repositories" title="Manage repositories">${uiGlyph('settings')}</button></header>
 ${detail?marketplaceDetail(detail.entry):`<div class="tavi-marketplace-find"><label for="tavi-store-search" class="sr-only">Search apps</label><input id="tavi-store-search" type="search" placeholder="Search apps" autocomplete="off" value="${esc(marketplaceQuery)}"></div>
 <nav class="tavi-marketplace-filters" aria-label="Filter apps"><button data-marketplace-filter="all" type="button" aria-pressed="${marketplaceFilter==='all'}">All</button><button data-marketplace-filter="installed" type="button" aria-pressed="${marketplaceFilter==='installed'}">Installed</button><button data-marketplace-filter="updates" type="button" aria-pressed="${marketplaceFilter==='updates'}">Updates${offers?` (${offers})`:''}</button></nav>
 ${extensionCatalogError?`<p role="alert" class="notice">${esc(extensionCatalogError)}</p>`:''}
 <div class="tavi-marketplace-list">${rows.map(marketplaceCard).join('')}</div><p class="tavi-marketplace-empty" id="tavi-marketplace-empty" hidden>No apps match this filter.</p>`}
 <p class="tavi-marketplace-status" role="status">${rows.length} apps · ${offers?`${offers} newer release${offers===1?'':'s'}`:'No newer releases found'}${summary.missing.length?` · ${summary.missing.length} missing source`:''}${extensionStaleSources.size?' · Some sources unavailable':''} · Checked ${esc(when)}</p>
 <details class="tavi-marketplace-repositories" id="tavi-marketplace-repositories"><summary>Repositories &amp; diagnostics</summary><p>App updates are checked every 15 minutes. Installing, updating, and switching sources always require approval. Hosted extension code is not stored locally.</p><p>Default: ${esc(TAVIX_REPOSITORY_URL)}</p>${extensionSuggested.length?`<p>Server suggestions: ${extensionSuggested.map(esc).join(', ')}</p>`:''}${subscriptions.map(url=>`<div class="row-actions"><code>${esc(url)}</code><button type="button" data-repository-remove="${esc(url)}">Remove</button></div>`).join('')}<form id="extension-repository-form" class="auth-form"><label>Custom repository URL<input type="url" name="repository" placeholder="https://example.org/tavi.repository.json" required></label><button type="submit">Add repository</button></form>${extensionRepoStatuses.length?`<details><summary>Connection errors (${extensionRepoStatuses.length})</summary>${extensionRepoStatuses.map(x=>`<p class="fineprint">${esc(x)}</p>`).join('')}</details>`:''}</details>
 </section>`;
}
function marketplaceApplySearch(){
 const items=[...document.querySelectorAll('.tavi-marketplace-item')];let shown=0;
 for(const item of items){
  const matchText=(item.dataset.marketplaceSearch||'').includes(marketplaceQuery.toLocaleLowerCase().trim());
  const matchFilter=marketplaceFilter==='all'||marketplaceFilter==='installed'&&item.dataset.marketplaceInstalled==='true'||marketplaceFilter==='updates'&&item.dataset.marketplaceUpdate==='true';
  item.hidden=!(matchText&&matchFilter);if(!item.hidden)shown++;
 }
 const empty=document.getElementById('tavi-marketplace-empty');if(empty)empty.hidden=shown>0;
 document.querySelectorAll('[data-marketplace-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.marketplaceFilter===marketplaceFilter)));
}
function extensionInstallDialog(){
 if(extensionSwitchApproval&&state.panel==='app-store'){
  const entry=extensionCatalog.find(e=>e.manifest.id===extensionSwitchApproval);
  const store=extensionAccountStore(),alt=entry&&alternateStoreRelease(entry);
  if(!alt)return '';
  const oldManifest=entry.manifest,latest=alt.manifest;
  const changedPermissions=latest.permissions.filter(permission=>!store.permissions(latest.id).includes(permission));
  return `<div class="tavi-install-overlay" role="presentation"><section class="tavi-install-dialog" role="dialog" aria-modal="true" aria-labelledby="tavi-install-heading"><h2 id="tavi-install-heading">Switch publisher source?</h2><p><strong>${esc(latest.name)}</strong> has a newer release from TaviX. This changes which repository you trust for future hosted code. It does not delete your local extension storage.</p><dl><dt>Current version</dt><dd>${esc(store.version(latest.id)||oldManifest.version)}</dd><dt>Current source</dt><dd>${esc(store.source(latest.id))}</dd><dt>New version</dt><dd>${esc(latest.version)}</dd><dt>New source</dt><dd>${esc(alt.repositoryUrl)}</dd><dt>Publisher</dt><dd>${esc(latest.publisher)}</dd><dt>Permissions</dt><dd>${esc(latest.permissions.join(', '))}</dd>${changedPermissions.length?`<dt>New permissions</dt><dd>${esc(changedPermissions.join(', '))}</dd>`:''}</dl><p class="tavi-install-warning">The new publisher-hosted code can behave differently. Your Tavi sign-in token is not shared.</p><div class="tavi-install-buttons"><button type="button" data-extension-switch-cancel>Cancel</button><button type="button" class="tavi-install-approve" data-extension-switch-approve="${esc(latest.id)}">Approve source switch</button></div></section></div>`;
 }
 if(!extensionInstallApproval||state.panel!=='app-store')return '';
 const entry=extensionCatalog.find(e=>e.manifest.id===extensionInstallApproval);
 if(!entry)return '';
 const m=entry.manifest;
 const origin=entry.remote?remoteOrigin(entry):null;
 const source=extensionSource(entry);
 const icon=appGlyph(m.id===ATRIUM_EXTENSION_ID?'atrium':'extension');
 const oldVersion=extensionAccountStore()?.version(m.id);
 return `<div class="tavi-install-overlay" role="presentation"><section class="tavi-install-dialog" role="dialog" aria-modal="true" aria-labelledby="tavi-install-heading" aria-describedby="tavi-install-description"><div class="tavi-install-heading"><span class="tavi-store-icon tone-forest" aria-hidden="true">${icon}</span><div><h2 id="tavi-install-heading">${esc(extensionAccountStore()?.installed(m.id)?'Update':'Install')} ${esc(m.name)}?</h2><small>${esc(m.publisher)} · ${esc(m.version)}</small></div></div><p id="tavi-install-description">${esc(m.summary)}</p><dl><dt>Permissions</dt><dd>${esc(m.permissions.join(', ')||'None')}</dd>${oldVersion?`<dt>Installed</dt><dd>${esc(oldVersion)}</dd><dt>Available</dt><dd>${esc(m.version)}${releaseRevision(entry)?` · revision ${esc(releaseRevision(entry).slice(0,12))}`:''}</dd>`:''}<dt>Extension source</dt><dd>${esc(entry.remote?'Remote repository':'Bundled with Tavi')}</dd>${origin?`<dt>Hosted origin</dt><dd>${esc(origin)}</dd><dt>Repository</dt><dd>${esc(source)}</dd>`:''}</dl><p class="tavi-install-warning">${entry.remote?'The publisher can update hosted code. ':''}Your Tavi sign-in token and messages are not shared.</p><div class="tavi-install-buttons"><button type="button" data-extension-install-cancel>Cancel</button><button type="button" class="tavi-install-approve" data-extension-install-approve="${esc(m.id)}">${esc(extensionAccountStore()?.installed(m.id)?'Approve update':'Install extension')}</button></div></section></div>`;
}
function extensionPanel(){
 const manifest=extensionEntry(extensionSelected)?.manifest;
 if(!manifest||!extensionEnabled(manifest.id))return `<section class="utility"><p>${extensionSelected===CORE_WALLET_ID?'Wallet is temporarily unavailable.':'Extension is not enabled.'}</p><button data-action="${extensionReturnsHome(extensionSelected)?'home':'app-store'}">Return to ${extensionReturnsHome(extensionSelected)?'Home':'App Store'}</button></section>`;
 return `<section class="tavi-extension-panel ${manifest.id===BUNDLED_COMPANION_ID?'tavi-companion-world-host':''}"><div class="tavi-extension-toolbar"><strong>${esc(manifest.name)}</strong><button data-action="${extensionReturnsHome(manifest.id)?'home':'app-store'}" type="button">${uiGlyph('back')} ${extensionReturnsHome(manifest.id)?'Home':'App Store'}</button></div><div id="tavi-extension-surface" data-extension-id="${esc(manifest.id)}" class="tavi-extension-frame"></div></section>`;
}
function attachExtensionFrame(previous){
 const slot=document.getElementById('tavi-extension-surface');
 if(!slot){clearPendingLifeLaunch();extensionHost.unmount();return;}
 const entry=extensionEntry(extensionSelected),store=extensionAccountStore();
 if(!entry||!extensionEnabled(entry.manifest.id)||!store||store.source(entry.manifest.id)!==extensionSource(entry)){clearPendingLifeLaunch();extensionHost.unmount();return;}
 if(previous?.dataset?.extensionId===extensionSelected && store.source(extensionSelected)===extensionSource(entry)){slot.append(previous);presentPendingLifeLaunch();return;}
 clearPendingLifeLaunch();extensionHost.unmount();
 if(!extensionVerified.has(extensionSelected))return;
 const frame=document.createElement('iframe');
 frame.setAttribute('sandbox','allow-scripts');
 frame.referrerPolicy='no-referrer';frame.title=entry.manifest.name;
 frame.dataset.extensionId=extensionSelected;
 frame.src=extensionPanelUrl(entry.remote ? entry.remote.entrypoint : extensionAssetUrl(entry.manifest.id,entry.manifest.entrypoints.panel,extensionBase()),{companion:entry.manifest.id===BUNDLED_COMPANION_ID});
 slot.append(frame);
 extensionHost.mount(frame,{id:entry.manifest.id,permissions:entry.manifest.id===CORE_WALLET_ID?['ui.panel']:store.permissions(entry.manifest.id),scope:extensionStoreScope,source:entry.manifest.id===CORE_WALLET_ID?'tavi:bundled':extensionSource(entry),reviewedBundle:entry.manifest.id===BUNDLED_COMPANION_ID&&extensionVerified.has(BUNDLED_COMPANION_ID)?REVIEWED_COMPANION.sha256:null});
}
async function openInstalledExtension(id){
 if(id===CORE_WALLET_ID)return openCoreWallet();
 const entry=extensionCatalog.find(e=>e.manifest.id===id);
 if(!entry||!extensionAccountStore()?.enabled(id))return toast('Extension is not installed or enabled.');
 if(extensionAccountStore()?.source(id)!==extensionSource(entry))return toast('Extension repository changed. Remove and reinstall before opening.');
 if(extensionUpdateStatus(entry,extensionAccountStore())!=='current')return toast('Extension metadata has changed. Review it in the App Store before opening.');
 try{
  if(!extensionVerified.has(id)){if(id===BUNDLED_COMPANION_ID&&!entry.remote)await verifyReviewedCompanion(entry);if(!entry.remote)await verifyBundledExtension(entry,{baseUrl:extensionBase()});extensionVerified.add(id);}
  clearPendingLifeLaunch();extensionSelected=id;state.panel='extension';state.mobileRoster=false;render();
 }catch(error){toast('Extension verification failed: '+error.message);}
}
async function installExtension(id){
 if(id===CORE_WALLET_ID)return toast('Wallet is a built-in Tavi app; no installation is needed.');
 const entry=extensionCatalog.find(e=>e.manifest.id===id),store=extensionAccountStore();if(!entry||!store||extensionBusy)return;
 const m=entry.manifest;
 if(!validateExtensionManifest(m).compatible)return toast('This extension requires a different host API version.');
 if(m.platforms && !m.platforms.includes(clientPlatform))return toast('Extension is unavailable on this platform.');
 if(store.installed(m.id)&&store.source(m.id)!==extensionSource(entry))return toast('Remove the existing installation before changing repository.');
 if(store.installed(m.id)&&extensionUpdateStatus(entry,store)!=='update-available')return toast('No compatible newer release to install.');
 if(entry.repositoryUrl&&extensionStaleSources.has(entry.repositoryUrl))return toast('Publisher repository cannot be checked. Update blocked.');
 if(extensionInstallApproval!==id){extensionInstallApproval=id;render();return;}
 extensionInstallApproval=null;
 extensionBusy=true;render();
 try{if(m.id===BUNDLED_COMPANION_ID&&!entry.remote)await verifyReviewedCompanion(entry);if(!entry.remote)await verifyBundledExtension(entry,{baseUrl:extensionBase()});store.install(m,extensionSource(entry),releaseRevision(entry),entry.remote?.entrypoint||null);extensionVerified.add(id);toast(`${m.name} installed. Select Open to launch it.`);}
 catch(error){toast('Installation blocked: '+error.message);}
 finally{extensionBusy=false;render();}
}


async function switchExtensionSource(id){
 const entry=extensionCatalog.find(e=>e.manifest.id===id),store=extensionAccountStore(),scope=extensionStoreScope;
 if(!entry||!store||extensionBusy||extensionSwitchApproval!==id)return;
 const candidate=alternateStoreRelease(entry);
 if(!candidate)return toast('No newer verified TaviX source is available.');
 const check=migrationEligibility(candidate,store,{staleSources:extensionStaleSources,platform:clientPlatform});
 if(!check.allowed)return toast(check.reason);
 extensionBusy=true;
 try{
  // Re-read the official catalog at approval time so an old confirmation
  // cannot silently approve different publisher metadata or permissions.
  const fresh=await fetchRepository(TAVIX_REPOSITORY_URL);
  const next=fresh.find(e=>e.manifest.id===id);
  if(!next||JSON.stringify(next.manifest)!==JSON.stringify(candidate.manifest)||releaseRevision(next)!==releaseRevision(candidate)||next.remote.entrypoint!==candidate.remote.entrypoint)throw Error('Publisher metadata changed. Review the source again.');
  if(store!==extensionAccountStore()||scope!==extensionStoreScope||state.panel!=='app-store'||extensionSwitchApproval!==id)throw Error('Sign-in or approval context changed');
  const guard=migrationEligibility(next,store,{platform:clientPlatform});if(!guard.allowed)throw Error(guard.reason);
  const wasEnabled=store.enabled(id);
  store.install(next.manifest,extensionSource(next),releaseRevision(next),next.remote.entrypoint);
  if(!wasEnabled)store.disable(id);
  extensionVerified.delete(id);extensionHost.unmount();
  extensionDiscoveredCatalog=[...extensionDiscoveredCatalog.filter(x=>x.repositoryUrl!==TAVIX_REPOSITORY_URL),...fresh];
  extensionCatalog=extensionCatalog.map(e=>e.manifest.id===id?next:e);
  marketplaceSelected=id;
  toast(`${next.manifest.name} switched to TaviX ${next.manifest.version}. Local data retained.`);
 }catch(error){toast('Source switch blocked: '+error.message);}
 finally{extensionSwitchApproval=null;extensionBusy=false;render();}
}

let mailboxWake=null;
let updateInfo=null,updateChecked=false,updateError='',updatePoll=null;
let updaterListener=null,androidUpdateStatus={stage:'idle',code:'',note:''};
const updaterStages=new Set(['idle','downloading','verifying','verified','permission_required','install_pending','awaiting_approval','installed','cancelled','failed']);
function safeUpdateStatus(value){
 const stage=updaterStages.has(value?.stage)?value.stage:'failed';
 return {stage,code:String(value?.code||'').slice(0,48).replace(/[^a-z0-9_]/gi,''),
  note:String(value?.note||'').slice(0,160).replace(/[\r\n]/g,' '),
  version:/^\d+\.\d+\.\d+$/.test(value?.version||'')?value.version:'',
  permission:value?.permission==='granted'?'granted':value?.permission==='required'?'required':'unknown',
  installedVersion:String(value?.installedVersion||'').slice(0,30),
  androidApi:Number(value?.androidApi)||0};
}
function showUpdateStatus(payload){androidUpdateStatus=safeUpdateStatus(payload);if(state.panel==='settings')render();}
async function listenAndroidUpdater(){
 if(clientPlatform!=='android'||!isTauri())return;
 if(!updaterListener){const {addPluginListener,invoke}=await import('@tauri-apps/api/core');
  // Some native plugin versions cannot deliver events: the Refresh button polls native status.
  try{updaterListener=await addPluginListener('tavi-android-updater','status',event=>showUpdateStatus(event));}catch{}
  try{showUpdateStatus(await invoke('tavi_android_update_status'));}catch{}}
}
async function testAndroidUpdater(){
 if(clientPlatform!=='android'||!isTauri()){toast('Android updater self-test is only available in the Android app.');return;}
 try{
  await listenAndroidUpdater();
  const release=await checkTaviRelease('0.0.0');
  if(!release.androidUrl)throw Error('No official signed APK published');
  const {invoke}=await import('@tauri-apps/api/core');
  await invoke('tavi_android_test_update',{url:release.androidUrl});
  toast('Updater self-test started. It will not install anything.');
 }catch(error){androidUpdateStatus=safeUpdateStatus({stage:'failed',code:'self_test_start',note:'Could not start the official APK self-test; check the network and try again'});render();}
}
async function copyAndroidUpdaterDiagnostics(){
 const result=safeUpdateStatus(androidUpdateStatus);
 const report=JSON.stringify({component:'tavi-android-updater',clientVersion:CLIENT_VERSION,...result},null,2);
 try{await navigator.clipboard.writeText(report);toast('Updater diagnostics copied (no account data or URLs).');}
 catch{toast('Clipboard unavailable. Read updater status in Settings.');}
}

async function checkForUpdates(manual=false){
 try{const result=await checkTaviRelease(CLIENT_VERSION);updateInfo=result.available&&localStorage.getItem(`tavi.update.dismissed.${result.version}`)!=='yes'?result:null;updateChecked=true;updateError='';if(manual)toast(updateInfo?`Tavi ${result.version} is available.`:'Tavi is up to date.');else render();}
 catch(error){updateChecked=true;updateError=error.message;if(manual)toast('Update check unavailable: '+error.message);}
}
async function openReleaseDownload(){
 if(clientPlatform==='android'&&isTauri()){
  if(!updateInfo?.androidUrl){toast('This release does not include a signed Android APK.');return;}
  try{await listenAndroidUpdater();const {invoke}=await import('@tauri-apps/api/core');await invoke('tavi_android_install_update',{url:updateInfo.androidUrl});toast('Downloading verified Tavi APK; see Settings → Android updater for progress.');}
  catch(e){toast('Unable to start Android update: '+String(e));}
  return;
 }
 const url=RELEASES_URL;
 try{if(isTauri())await openUrl(url);else window.open(url,'_blank','noopener,noreferrer');}
 catch(e){toast('Unable to open update: '+e.message);}
}

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=sec=>new Date(sec*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const initial=name=>esc((name||'?').slice(0,1).toUpperCase());
const nameOf=peer=>state.contacts.find(x=>x.id===peer)?.username||peer;
const unreadTotal=()=>Object.values(state.unread).reduce((n,x)=>n+(Number(x)||0),0);
const displayNameOf=contact=>contact?.displayName||contact?.username||contact?.id||'';
const sortContacts=list=>[...list].sort((a,b)=>displayNameOf(a).localeCompare(displayNameOf(b),undefined,{sensitivity:'base'}));
const extensionUpdateCount=()=>optionalUpdateSummary(extensionCatalog,extensionAccountStore(),{staleSources:extensionStaleSources}).count;
const appUpdateCount=()=>extensionUpdateCount()+(updateInfo?1:0);
function setTheme(theme){state.theme=normalizeTheme(theme);config.theme=state.theme;writeConfig(config);applyTheme();if(nativeDesktop)for(const label of nativeChildLabels)void emitTo(label,'tavi-ui-theme',{theme:state.theme}).catch(()=>{});render();}
const isSafeAtriumUrl=value=>!!reviewedAtriumBase(value);
const pushKey=()=>pushPreferencesKey(state.api.origin,state.profile.profileId);
applyTheme();
function backgroundPushState(){return pushReadiness({platform:clientPlatform,preference:state.pushPrefs.backgroundEnabled,capability:state.pushCapability,permission:state.pushPermission,nativeAdapter:false});}
async function refreshPushReadiness(){const api=state.api;if(!api)return;const oldAtrium=state.atriumUrl;try{const [capability,permission]=await Promise.all([api.command('capabilities'),notificationPermissionStatus()]);if(api!==state.api)return;state.pushCapability=parsePushCapabilities(capability);state.pushPermission=permission;state.atriumUrl=isSafeAtriumUrl(capability.atriumUrl)?capability.atriumUrl:null;}catch{if(api!==state.api)return;state.pushCapability=null;state.atriumUrl=null;state.pushPermission=await notificationPermissionStatus();}if(state.panel==='settings'||oldAtrium!==state.atriumUrl)render();}
const readKey=()=>readStateKey(state.api.origin,state.profile.profileId);
function storeRead(){try{saveChatReadState(localStorage,readKey(),state.chatRead);}catch{}}
function markRead(peer,messages){
 if(!state.api||peer==='lobby'||!Array.isArray(messages)||!messages.length)return;
 const next=acknowledgeDirectFeed(messages,state.chatRead[peer]);
 if(next.read<=safeRead(state.chatRead[peer]?.read))return;
 state.chatRead[peer]=next;state.unread[peer]=0;storeRead();
 if(state.summarySupported)void pushRead(state.api,peer,next.read);
}
const safeRead=id=>Number.isSafeInteger(id)&&id>0?id:0;
const safeReceipt=id=>Number.isSafeInteger(id)&&id>=0?id:0;
function rememberPeerReceipts(peer,data){
 if(!/^acct_[0-9]{1,19}$/.test(peer||''))return;
 state.peerReceipts.set(peer,{peerDeliveredId:safeReceipt(data?.peerDeliveredId),peerReadId:safeReceipt(data?.peerReadId)});
}
function peerReceipt(peer){return state.peerReceipts.get(peer)||{peerDeliveredId:0,peerReadId:0};}
function receiptMarkup(message,peer,modern=false){
 const status=peer&&state.profile?messageReceipt(message,state.profile.profileId,peerReceipt(peer)):null;
 return status?`<span class="message-receipt${modern?' modern':''}" aria-label="${status}">${status}</span>`:'';
}
function composerFeedback(peer,value=state.draft){return composerState(value,messageLimit(peer));}
function updateComposerFeedback(field,peer){
 const info=composerFeedback(peer,field?.value||'');
 const count=document.getElementById('message-count'),error=document.getElementById('message-error'),button=field?.form?.querySelector('[type="submit"]');
 if(count){count.textContent=info.label;count.classList.toggle('near-limit',info.near);count.classList.toggle('over-limit',info.over);}
 if(error){error.textContent=info.error;error.hidden=!info.error;}
 if(button)button.disabled=state.busy||info.over;
 return info;
}
async function pushRead(api,peer,id){
 if(!id||api!==state.api||!state.summarySupported)return;
 const current=state.pendingAcks.get(peer)||0;
 if(current>=id)return;
 state.pendingAcks.set(peer,id);
 try{await api.markDirectRead(peer,id);}catch(err){if(api===state.api){state.pendingAcks.delete(peer);console.warn('Read state sync failed:',err.message);}}
 finally{if(state.pendingAcks.get(peer)===id)state.pendingAcks.delete(peer);}
}

const peerVisible=peer=>!nativeDesktop && state.panel==='messenger' && state.peer===peer && !state.mobileRoster && document.visibilityState!=='hidden';
const toast=(msg)=>{state.toast=String(msg);render();clearTimeout(toastTimer);toastTimer=setTimeout(()=>{state.toast='';render();},5000)};
function avatar(name,online=false){return `<span class="avatar ${online?'active':''}">${initial(name)}</span>`;}
function header(){return `<header class="top"><span class="brand-icon" aria-hidden="true"></span><strong>Tavi</strong><span class="top-version">Games &amp; friends</span><span class="server-chip"><span class="presence ${state.connected?'online':''}"></span>${state.connected?esc(new URL(state.api.origin).host):'Disconnected'}</span><button type="button" class="chrome-button" data-action="settings" title="Options" aria-label="Options">${uiGlyph('settings')}</button></header>`;}
function companionPortraitButton(){
 const installed=extensionEnabled(BUNDLED_COMPANION_ID);
 const preview=installed&&extensionVerified.has(BUNDLED_COMPANION_ID)?readCompanionPreview(localStorage,extensionStoreScope):null;
 const label=installed?'Open '+(preview?.name||'Companion'):'Install Companion';
 return `<button type="button" data-action="companion" class="tavi-profile-pet tavi-companion-portrait" title="${esc(label)}" aria-label="${esc(label)}">${preview?`<img class="tavi-companion-portrait-img" src="${esc(preview.image)}" alt="">`:'<span class="tavi-companion-portrait-empty" aria-hidden="true">✧</span>'}<small>${esc(preview?.name||'Companion')}</small></button>`;
}
function menuBar(compact=false){return `<nav class="menubar" aria-label="Messenger menu"><details class="menu-drop"><summary>File</summary><div class="menu-options"><button data-action="settings">Options…</button><button data-action="signout">Sign out</button></div></details><details class="menu-drop"><summary>Contacts</summary><div class="menu-options"><button data-action="contacts">Contact list</button><button data-action="add-friend">Add a contact…</button></div></details><details class="menu-drop"><summary>Actions</summary><div class="menu-options"><button data-action="messenger">Conversations</button><button data-action="games">Games &amp; alerts</button><button data-action="atrium">Open Atrium ↗</button><button data-action="inbox">Interactive inbox</button><button data-action="notifications">Enable alerts</button></div></details><details class="menu-drop"><summary>Tools</summary><div class="menu-options"><button data-action="portrait">Change portrait…</button><button data-action="companion">Companions…</button><button data-action="settings">Settings…</button><button data-action="app-store">App Store…</button>${state.developerAllowed&&state.developerVisible?'<button data-action="developer">Admin / Debug</button>':''}</div></details><details class="menu-drop"><summary>Help</summary><div class="menu-options"><button data-action="about">About Tavi</button><button data-action="copy-diagnostics">Copy diagnostics…</button><button data-action="check-updates">Check Tavi updates…</button><button data-action="check-extension-updates">Check app updates…</button>${updateInfo?'<button data-action="download-update">Download Tavi '+esc(updateInfo.version)+'</button>':''}</div></details></nav>`;}
function windowCaption(title,actions=''){return `<div class="window-titlebar"><span class="caption-mark" aria-hidden="true"></span><strong>${esc(title)}</strong><span class="window-actions">${actions}</span></div>`;}
function signIn(){return `<div class="login-desktop"><section class="welcome classic-window" aria-label="Sign in to Tavi">${uiHeader({title:'Tavi · Sign in',actions:[{label:'Help',icon:'help',action:'about'}]})}<div class="welcome-body"><div class="welcome-icon" aria-hidden="true"><span class="welcome-mark"></span></div><div class="welcome-brand">Tavi</div><p class="welcome-caption">Games. Friends. Together.</p><form id="server-form" class="auth-form"><label>LoopRD server address<input name="server" type="url" placeholder="https://your-server.example" required value="${esc(config.server)}" autocomplete="url"></label><div class="right-actions"><button class="solid" ${connecting?'disabled':''}>Connect…</button></div></form>${state.serverStatus?`<div class="notice" role="status">${esc(state.serverStatus)}</div>`:''}${state.retryAvailable?`<div class="session-retry" role="group" aria-label="Saved device sign-in"><span>Remembered account on ${esc(new URL(state.retryOrigin).host)}</span><button type="button" data-action="retry-session" ${state.restoring?'disabled':''}>${state.restoring?'Connecting…':'Retry saved sign-in'}</button><button type="button" data-action="switch-account">Use another account</button></div>`:''}${state.step==='account'?`<div class="loginbox"><div class="switch"><button type="button" data-auth="login" class="${state.authTab==='login'?'picked':''}">Sign in</button><button type="button" data-auth="register" class="${state.authTab==='register'?'picked':''}">Create account</button>${state.recoverySupported?`<button type="button" data-auth="recover" class="${state.authTab==='recover'?'picked':''}">Recover account</button>`:''}</div><form id="auth-form" class="auth-form"><label>Username<input name="username" minlength="3" maxlength="24" required autocomplete="username" placeholder="Username"></label>${state.authTab==='recover'?`<label>Recovery code<input name="recoveryCode" required maxlength="44" spellcheck="false" autocomplete="off" placeholder="TAVI-XXXX-..."></label>`:''}<label>${state.authTab==='recover'?'New password':'Password'}<input name="password" type="password" minlength="12" maxlength="128" required autocomplete="${state.authTab==='login'?'current-password':'new-password'}"></label><label class="remember-device"><input name="remember" type="checkbox" value="yes"> Keep me signed in on this device</label><p class="small-help">Use 3–24 lowercase letters, digits or underscores; start with a letter. Password: 12–128 characters.</p>${state.authError?`<p class="notice" role="alert">${esc(state.authError)}</p>`:''}<div class="right-actions"><button class="solid" ${connecting?'disabled':''}>${state.authTab==='register'?'Create account':state.authTab==='recover'?'Recover account':'Sign in'}</button></div></form><p class="small-help">Windows encrypts the remembered session in a file protected by your Windows account. Only enable remembering on a trusted device.</p>${state.recoverySupported?'<p class="small-help">Lost your password? Use a recovery code saved earlier under Settings &amp; account. Recovery signs out your other devices.</p>':''}<p class="small-help">Accounts and chats belong to the Social component on this server. No developer token or external identity provider needed.</p></div>`:''}</div><div class="report-login"><details ${state.reportStatus?'open':''}><summary>Report a login problem to LoopRD</summary><p class="small-help">Sends Tavi version, platform and a generic failure code to your LoopRD server. Do not include passwords, usernames, tokens or personal details.</p><label>Optional description<textarea id="bug-report-note" maxlength="400" placeholder="What happened? (no personal information)"></textarea></label><button type="button" data-action="send-bug-report" ${state.reportSending?'disabled':''}>${state.reportSending?'Sending…':'Send report to LoopRD'}</button>${state.reportStatus?`<p class="small-help" role="status">${esc(state.reportStatus)}</p>`:''}</details></div><div class="window-status">${state.step==='account'?'Server found — sign in or create an account':'Enter your community server to continue'}</div></section></div>`;}
function buddyRow(peer){const isCurrent=state.peer===peer.id&&state.panel==='messenger';const badge=peer.status==='pending'?peer.direction==='incoming'?'Wants to add you':'Invitation sent':peer.online?'Online':'Offline';const unread=peer.status==='accepted'?(state.unread[peer.id]||0):0;const summary=state.conversationSummaries.find(x=>x.peer===peer.id);const preview=summary?.latest?(state.notifyPrefs.preview?String(summary.latest.text).slice(0,65):'Recent message · '+stamp(summary.latest.at)):'';return `<button class="buddy ${isCurrent?'chosen':''}" data-peer="${esc(peer.id)}" data-contact-name="${esc(peer.username.toLowerCase())}">${avatar(peer.username,peer.online&&peer.status==='accepted')}<span class="buddy-copy"><strong><span class="tavi-inline-presence ${peer.online&&peer.status==='accepted'?'online':'offline'}" role="img" aria-label="${peer.online&&peer.status==='accepted'?'Online':'Offline'}"></span>${esc(peer.username)}</strong><small>${esc(preview||badge)}</small></span>${unread?`<span class="unread-badge" aria-label="${unread} unread messages">${unread===99?'99+':unread}</span>`:''}${peer.status==='pending'&&peer.direction==='incoming'?'<span class="req-badge">!</span>':''}</button>`;}
function rosterGroup(id,title,peers,empty=''){return `<div class="roster-group"><button type="button" class="group-title" data-group="${id}" aria-expanded="${state.rosterGroups[id]!==false?'true':'false'}"><span class="arrow">${state.rosterGroups[id]!==false?'▾':'▸'}</span>${esc(title)} (${peers.length})</button><div class="group-entries" ${state.rosterGroups[id]===false?'hidden':''}>${peers.map(buddyRow).join('')||`<span class="empty-buddies">${esc(empty)}</span>`}</div></div>`;}
function compactContactGroups(recent,online,offline,total){
 const count=total;
 const section=(title,peers,empty='')=>`<div class="tavi-roster-compact-section"><span class="tavi-roster-compact-label">${title}</span>${peers.map(buddyRow).join('')|| (empty?`<small class="tavi-roster-compact-empty">${empty}</small>`:'')}</div>`;
 return `<div class="roster-group tavi-roster-merged"><button type="button" class="group-title" data-group="conversations" aria-expanded="${state.rosterGroups.conversations!==false}"><span class="arrow">${state.rosterGroups.conversations!==false?'▾':'▸'}</span>Conversations &amp; contacts (${count})</button><div class="group-entries" ${state.rosterGroups.conversations===false?'hidden':''}><button data-peer="lobby" data-contact-name="community lobby" class="buddy tavi-lobby-row ${state.peer==='lobby'&&state.panel==='messenger'?'chosen':''}"><span class="avatar lobby-icon">✉</span><span class="buddy-copy"><strong>Community Lobby</strong><small>Public server chat</small></span></button>${recent.length?section('Recent conversations',recent):''}${online.length?section(`Online (${recent.filter(x=>x.online).length+online.length})`,online):''}${offline.length?section(`Offline (${recent.filter(x=>!x.online).length+offline.length})`,offline):''}${!recent.length&&!online.length&&!offline.length?'<small class="tavi-roster-compact-empty">No contacts yet</small>':''}</div></div>`;
}

function compactGames(){return '';}
function homeBuddyRow(peer){
 const online=peer.online&&peer.status==='accepted';
 const unread=state.unread[peer.id]||0;
 return `<button type="button" class="tavi-home-buddy" data-peer="${esc(peer.id)}" data-contact-name="${esc(peer.username.toLowerCase())}" aria-label="Open chat with ${esc(peer.displayName||peer.username)}">${avatar(peer.displayName||peer.username,online)}<span class="tavi-home-buddy-copy"><strong>${esc(peer.displayName||peer.username)}</strong><small><span class="tavi-inline-presence ${online?'online':'offline'}" aria-hidden="true"></span>${peer.status==='pending'?peer.direction==='incoming'?'Friend request':'Invitation pending':online?'Available':'Offline'}</small></span>${unread?`<span class="unread-badge" aria-label="${unread} unread messages">${unread>99?'99+':unread}</span>`:''}</button>`;
}
function homeBuddyGroup(id,title,peers){
 const expanded=state.rosterGroups[id]!==false;
 return `<section class="tavi-home-group"><button type="button" class="tavi-home-group-title" data-group="${id}" aria-expanded="${expanded}"><span aria-hidden="true">${expanded?'▾':'▸'}</span>${esc(title)}<span class="tavi-group-count">${peers.length}</span></button><div class="tavi-home-group-list" ${expanded?'':'hidden'}>${peers.map(homeBuddyRow).join('')||'<small class="tavi-home-empty-group">No contacts</small>'}</div></section>`;
}
function homeIdentity(){
 const display=state.profile?.displayName||state.profile?.username||'You';
 const gold=state.goldStatus==='available'?`${state.goldAmount} Gold`:state.goldStatus==='loading'?'Gold · loading…':'Gold unavailable';
 return `<section class="tavi-home-identity" aria-label="Your profile and Companion"><button class="tavi-home-self-portrait" type="button" data-action="portrait" aria-label="Edit your profile portrait">${avatar(display,true)}</button><div class="tavi-home-self-details"><strong>${esc(display)}</strong><small><span class="tavi-inline-presence online" aria-hidden="true"></span>Available</small><button type="button" data-action="wallet" class="tavi-gold-balance" aria-label="Open your Gold Wallet">${esc(gold)}</button></div><div class="tavi-home-companion">${companionPortraitButton()}</div></section>`;
}
function homeContactPane(){
 const groups=buddyGroups(state.contacts);
 const sort=items=>sortContacts(items);
 return `<section class="tavi-home-messenger" aria-label="Your messenger buddy list">${homeIdentity()}<div class="roster-scroll tavi-home-roster-scroll"><div class="tavi-home-contacts-heading"><strong>Friends</strong><button type="button" data-action="add-friend" aria-label="Add a friend">${uiGlyph('person-plus')}</button></div>${homeBuddyGroup('online','Online',sort(groups.online))}${homeBuddyGroup('offline','Offline',sort(groups.offline))}${groups.incoming.length?homeBuddyGroup('requests','Friend requests',sort(groups.incoming)):''}${groups.pending.length?homeBuddyGroup('pending','Pending invitations',sort(groups.pending)):''}${homeMinimized(true)}</div></section>`;
}
function messageThreadRow({id,label,preview,online=false,unread=0,kind='direct'}){
 const name=String(label||'Conversation');
 return `<button type="button" class="tavi-message-thread" data-message-thread data-message-kind="${esc(kind)}" data-message-name="${esc(name.toLocaleLowerCase())}" data-message-unread="${unread}" data-peer="${esc(id)}" data-contact-name="${esc(name.toLowerCase())}">${kind==='lobby'?`<span class="tavi-message-lobby-icon" aria-hidden="true">${uiGlyph('messages')}</span>`:avatar(name,online)}<span class="tavi-message-thread-copy"><strong>${esc(name)}</strong><small>${esc(preview)}</small></span>${unread?`<span class="unread-badge" aria-label="${unread} unread messages">${unread>99?'99+':unread}</span>`:''}</button>`;
}
function messageInbox(){
 const threads=conversationThreads(state.contacts,state.conversationSummaries,state.unread);
 const rows=[messageThreadRow({id:'lobby',label:'Community Lobby',preview:'Public server chat',kind:'lobby'}),...threads.map(({contact,latest,unread})=>messageThreadRow({id:contact.id,label:contact.displayName||contact.username,online:contact.online,unread,preview:latest?(state.notifyPrefs.preview?String(latest.text||'').slice(0,65):'Recent message · '+stamp(latest.at)):(contact.online?'Available':'Offline')}))];
 const filter=state.messageFilter;
 return `<section class="tavi-message-inbox" aria-label="Messages inbox"><div class="tavi-message-tools"><label class="tavi-message-search"><span class="sr-only">Search conversations</span><input type="search" id="message-search" placeholder="Search conversations" autocomplete="off" value="${esc(state.messageSearch)}"></label><button type="button" class="tavi-message-compose" data-action="add-friend" title="Start a conversation" aria-label="Start a conversation">${uiGlyph('person-plus')}</button></div><div class="tavi-message-filters" role="group" aria-label="Filter messages">${[['all','All'],['unread','Unread'],['friends','Friends']].map(([value,label])=>`<button type="button" data-message-filter="${value}" aria-pressed="${filter===value}">${label}</button>`).join('')}</div><div class="tavi-message-scroll"><div class="tavi-message-threads" id="message-threads" role="list" aria-label="Conversations">${rows.join('')}<p class="tavi-message-empty" data-message-empty hidden>No conversations match your search.</p></div></div></section>`;
}
function activePeer(){return state.contacts.find(x=>x.id===state.peer);}
function focusedConversation(){
 const peer=activePeer(),lobby=state.peer==='lobby',title=lobby?'Community Lobby':peer?.displayName||peer?.username||'Conversation';
 const messages=lobby?state.lobby:state.direct,pending=!lobby&&peer?.status!=='accepted',compose=composerFeedback(state.peer);
 const thread=messages.length?messages.map(m=>{
   const mine=m.authorId===state.profile?.profileId;
   return `<div class="tavi-chat-line ${mine?'mine':'theirs'}"><div class="tavi-chat-bubble">${esc(m.text)}</div><div class="tavi-chat-meta"><time>${stamp(m.at)}</time>${lobby?'':receiptMarkup(m,state.peer,true)}</div></div>`;
 }).join(''):'<div class="tavi-chat-empty">Say hello!</div>';
 return `<section class="tavi-modern-chat" aria-label="Conversation with ${esc(title)}"><header class="tavi-chat-top"><button type="button" data-action="back" aria-label="Back to messages">${uiGlyph('back')}</button>${avatar(title,peer?.online)}<div><strong>${esc(title)}</strong><small>${lobby?'Community':pending?'Friend request pending':peer?.online?'● Online':'Offline'}</small></div><button type="button" data-action="minimize-view" class="tavi-chat-minimize" aria-label="Minimize to Home">${uiGlyph('minimize')}</button></header><div class="tavi-chat-history" id="chat-scroll" role="log" aria-label="Messages">${thread}</div>${pending?`<div class="tavi-chat-pending"><p>${peer?.direction==='incoming'?'Accept this contact to start chatting.':'Waiting for your contact to accept.'}</p>${peer?.direction==='incoming'?'<button type="button" data-action="accept-friend">Accept friend</button>':''}</div>`:`<form id="message-form" class="tavi-chat-compose"><div class="tavi-compose-field"><textarea name="message" id="message" rows="2" placeholder="Write a message…" required aria-describedby="message-count message-error">${esc(state.draft)}</textarea><div class="tavi-compose-feedback"><span id="message-count" class="message-count ${compose.near?'near-limit':''} ${compose.over?'over-limit':''}">${compose.label}</span><span id="message-error" class="message-error" role="alert" ${compose.error?'':'hidden'}>${esc(compose.error)}</span></div></div><button type="submit" class="solid" ${state.busy||compose.over?'disabled':''} aria-label="Send message">${uiGlyph('send')}</button></form>`}</section>`;
}
function conversation(){
 const peer=activePeer(),lobby=state.peer==='lobby',pending=!lobby&&peer?.status!=='accepted',messages=lobby?state.lobby:state.direct,title=lobby?'Community Lobby':(peer?.username||'Conversation'),compose=composerFeedback(state.peer);
 const thread=messages.length?messages.map(m=>{const mine=m.authorId===state.profile?.profileId;return `<div class="transcript-message"><div class="transcript-heading"><strong class="${mine?'mine':''}">${mine?'You':esc(m.displayName||title)}</strong><time>${stamp(m.at)}</time>${lobby?'':receiptMarkup(m,state.peer)}</div><div class="transcript-text">${esc(m.text)}</div></div>`;}).join(''):'<div class="empty-chat"><strong>Welcome to this conversation</strong><p>Messages will appear here.</p></div>';
 return `<section class="conversation classic-window" aria-label="Conversation with ${esc(title)}">${windowCaption(title+' – Conversation', `<button data-action="contacts" class="chrome-button mobile-back" title="Contacts">${uiGlyph('back')}</button>`)}${menuBar(true)}<div class="conversation-tools"><button data-action="add-friend"><span>${uiGlyph('person-plus')}</span> Invite</button><button data-action="games"><span>${uiGlyph('games')}</span> Games</button><button data-action="notifications"><span>${uiGlyph('bell')}</span> Alerts</button><button data-action="portrait"><span>${uiGlyph('portrait')}</span> Picture</button>${!lobby&&peer?'<button data-action="remove-friend"><span>×</span> Remove</button>':''}</div><div class="chat-heading"><div class="chat-heading-left">${avatar(lobby?'#':title,peer?.online)}<div><h2>${esc(title)}</h2><small>${lobby?'Shared conversation on this server':pending?'Contact invitation pending':peer?.online?'Online':'Offline'}</small></div></div></div>${pending?`<div class="request-panel"><h3>${peer?.direction==='incoming'?'Friend request received':'Friend request sent'}</h3><p>${peer?.direction==='incoming'?'Accept to start a private conversation.':'Waiting for your friend to accept.'}</p>${peer?.direction==='incoming'?'<button class="solid" data-action="accept-friend">Accept request</button>':''}</div>`:`<div class="chat-content"><div class="chat-scroll" id="chat-scroll" role="log" aria-label="Messages" aria-live="off">${thread}</div><div class="participant-pane"><div class="participant-avatar">${avatar(lobby?'#':title,peer?.online)}</div><span>${esc(lobby?'Lobby':title)}</span><small>${lobby?'Community':peer?.online?'Online':'Contact'}</small></div></div><div class="compose-toolbar"><button title="Message formatting" type="button" data-action="format-help"><b style="font-family:Georgia,serif;font-size:17px">A</b> ▾</button><button type="button" data-action="portrait" title="Character portrait">☺ ▾</button><span>Enter to send · Shift+Enter for a new line</span><span id="message-count" class="message-count ${compose.near?'near-limit':''} ${compose.over?'over-limit':''}">${compose.label}</span></div><form id="message-form" class="composer"><div class="composer-field"><textarea name="message" id="message" rows="3" placeholder="Type your message here…" required aria-describedby="message-count message-error">${esc(state.draft)}</textarea><span id="message-error" class="message-error" role="alert" ${compose.error?'':'hidden'}>${esc(compose.error)}</span></div><div class="send-controls"><button class="solid" ${state.busy||compose.over?'disabled':''}>Send</button></div></form>`}<div class="window-status"><span class="presence ${lobby||peer?.online?'online':''}"></span>${esc(lobby?'Public server lobby':'Private message')}${state.lastSyncAt?`<span class="status-right">Last update ${new Date(state.lastSyncAt).toLocaleTimeString()}</span>`:''}</div></section>`;
}
function addFriend(){return `<section class="utility"><h2>Add a friend</h2><p>Find someone on this Tavi server by username. Federation between servers is planned, but not enabled yet.</p><form id="friend-form" class="auth-form"><label>Friend's username<input name="username" required minlength="3" maxlength="24" pattern="[a-z][a-z0-9_]{2,23}" placeholder="e.g. alex_42" autocomplete="off"></label>${state.friendError?`<p class="notice" role="alert">${esc(state.friendError)}</p>`:''}<div class="row-actions"><button class="solid">Send friend request</button><button type="button" data-action="contacts">Cancel</button></div></form><p class="fineprint">Friends must accept before private messages become available. A username on a different server cannot be added yet.</p></section>`;}
function gameRoomPanel(){
 const room=state.gameRooms.find(r=>r.roomId===state.selectedRoomId);
 const available=state.gameRooms.length?state.gameRooms.map(r=>
  `<button type="button" data-select-game-room="${esc(r.roomId)}" class="${state.selectedRoomId===r.roomId?'picked':''}">♟ ${esc(r.gameId)} · ${esc(r.matchId.slice(0,24))} (${Number(r.participants)||0} players)</button>`).join(''):
  '<p class="fineprint">No active matches yet. When a game confirms your place, it will appear here.</p>';
 return `<section class="game-room-panel" aria-label="Private match conversations"><h3>Your matches</h3>
 <p class="fineprint">Chats appear alongside matches you have joined.</p>
 ${state.roomError?`<p class="notice" role="alert">${esc(state.roomError)}</p>`:''}
 <div class="row-actions game-room-list">${available}</div>
 ${room?`<div class="game-room-thread"><h4>${esc(room.gameId)} · Match chat</h4>${nativeDesktop?`<button type="button" data-open-match-window="${esc(room.roomId)}">Open separate chat window ↗</button>`:''}
 <div class="game-room-messages" role="log" aria-label="Match messages">${state.roomMessages.length?state.roomMessages.map(m=>
  `<p><strong>${esc(m.displayName)}</strong>: ${esc(m.text)}</p>`).join(''):'<p>No messages yet.</p>'}</div>
 <form id="game-room-form" class="game-room-compose"><label>Message to match players
 <textarea name="text" maxlength="1000" rows="2" required placeholder="Message your match…">${esc(state.roomDraft)}</textarea></label><button type="submit" ${state.busy?'disabled':''}>Send to match</button></form></div>`:''}</section>`;
}
function gameSettings(){
 const friends=state.contacts.filter(c=>c.status==='accepted');
 const options=`<option value="">Choose a friend…</option>`+friends.map(c=>`<option value="${esc(c.id)}">${esc(c.displayName||c.username)}</option>`).join('');
 const discovered=state.atriumGames.map(g=>`<div class="tavi-game-list-row" data-discovered-game="${esc(g.gameId)}"><span class="tavi-game-list-icon" aria-hidden="true">♟</span><span class="tavi-game-list-info"><strong>${esc(g.title)}</strong><small>Discovered · ${esc(g.publisher)}</small></span><span class="tavi-game-status">Not playable yet</span></div>`).join('');
 const games=state.catalog.map(g=>`<div class="tavi-game-list-row"><span class="tavi-game-list-icon" aria-hidden="true">🎮</span><span class="tavi-game-list-info"><strong>${esc(g.name)}</strong><small>${g.embedded?'Game available':'Opens in browser'}</small></span><button type="button" class="tavi-game-action" ${g.embedded?`data-launch-game="${esc(g.id)}"`:`data-open-promoted="${esc(g.id)}"`}>Play</button></div><form class="tavi-game-invite" data-challenge-game="${esc(g.id)}"><select name="peer" aria-label="Friend to invite to ${esc(g.name)}" required>${options}</select><button type="submit" ${friends.length?'':'disabled'}>Invite friend</button></form>`).join('');
 const rooms=state.gameRooms.length?state.gameRooms.map(r=>`<button class="tavi-game-list-row" type="button" data-select-game-room="${esc(r.roomId)}"><span class="tavi-game-list-icon" aria-hidden="true">▤</span><span class="tavi-game-list-info"><strong>${esc(r.gameId)}</strong><small>Match · ${esc(r.matchId.slice(0,20))}</small></span><span class="tavi-game-status">Open chat ›</span></button>`).join(''):'';
 const turns=state.turns.filter(t=>t.status==='your-turn').slice(0,6).map(t=>`<button class="tavi-game-list-row" type="button" data-route="${esc(t.path||'')}" ${t.path?'':'disabled'}><span class="tavi-game-list-icon">⏱</span><span class="tavi-game-list-info"><strong>${esc(t.title)}</strong><small>Your turn</small></span><span>›</span></button>`).join('');
 const atrium=atriumLauncher(state.atriumUrl);
 const status=state.atriumDiscoveryStatus==='connected'?'No reviewed games are currently available from Atrium.':state.atriumDiscoveryStatus==='unavailable'?'Game discovery is temporarily unavailable.': 'Connect this server to Atrium to discover games.';
 return `<section class="utility tavi-games-browser" aria-label="Games"><h2>Games</h2><div class="tavi-games-group"><h3>Your games</h3>${turns||rooms||'<p class="tavi-game-empty">No active games yet.</p>'}${turns&&rooms?rooms:''}${state.selectedRoomId?gameRoomPanel():''}</div><div class="tavi-games-group"><h3>Play with friends</h3>${games||'<p class="tavi-game-empty">No playable games published yet.</p>'}</div><div class="tavi-games-group"><div class="tavi-game-title-row"><h3>Discover games</h3><button type="button" data-action="refresh" title="Refresh this server’s game discovery">Refresh ↻</button>${atrium.available?'<button type="button" data-action="atrium">Browse Atrium ↗</button>':''}</div>${discovered||`<p class="tavi-game-empty">${esc(status||'No games discovered yet.')}</p>`}</div><div class="tavi-games-group"><h3>Invitations</h3><p class="tavi-game-empty">Game invitations and replies appear in your Inbox.</p><button type="button" data-action="inbox">Open invitations</button></div></section>`;
}

function companion(){return companionPanel(tickCompanion(state.companion),{desktopFloatingAvailable:nativeWindowsPet});}
function portrait(){return `<section class="utility portrait"><h2>Your character</h2><p>Portraits use the latest metadata from the official Portrait Library; the generator's executable source is reviewed and pinned to an upstream revision.</p><iframe title="Character portrait workshop" id="portrait-frame" src="./portrait/index.html" loading="lazy"></iframe><p>Portrait code saved in your Social profile: <code>${esc(state.avatarCode||'Not set')}</code></p></section>`;}
function inbox(){
 const filter=state.inboxFilter;
 const selected=state.interactions.find(e=>e.id===state.selectedInteraction);
 const open=state.interactions.filter(e=>e.status==='open').length;
 const visible=state.interactions.filter(e=>filter==='all'||(filter==='open'?e.status==='open':e.status!=='open'));
 return `<section class="interaction-inbox" aria-label="Interactive inbox"><div class="inbox-header"><h2>Inbox <span class="inbox-counter">${open}</span></h2><button type="button" data-action="refresh" title="Refresh inbox">↻ Refresh</button></div><p class="fineprint">Requests from ${esc(new URL(state.api.origin).host)}. Permissions are checked on each action.</p><div class="inbox-filters" role="group" aria-label="Filter notifications">${[['open','Needs action'],['history','History'],['all','All']].map(([id,title])=>`<button type="button" data-inbox-filter="${id}" aria-pressed="${filter===id}" class="${filter===id?'picked':''}">${title}</button>`).join('')}</div>${state.interactionError?`<p class="notice" role="alert">${esc(state.interactionError)}</p>`:''}<div class="interaction-list">${visible.length?visible.map(e=>`<button type="button" class="interaction-entry ${selected?.id===e.id?'chosen':''}" data-interaction="${e.id}" aria-expanded="${selected?.id===e.id}"><span><strong>${esc(e.title)}</strong><small>${esc(e.topic)} · ${esc(e.status)} · ${new Date(e.created*1000).toLocaleDateString()}</small></span><span>›</span></button>`).join(''):'<p class="fineprint">No notifications in this view.</p>'}</div>${selected?interactionDetail(selected):''}</section>`;
}
function interactionDetail(e){
 const active=e.status==='open';
 return `<div class="interaction-detail"><h3>${esc(e.title)}</h3><p>${esc(e.body||'')}</p><p class="fineprint">From ${esc(e.publisher)} · ${esc(e.status)} · Expires ${esc(new Date(e.expires*1000).toLocaleString())}</p>${active?'<div class="interaction-commands"><button type="button" data-interaction-dismiss="'+e.id+'">Dismiss</button></div>':''}${active?(e.actions||[]).map(a=>a.type==='reply'?`<form class="interaction-reply" data-interaction-reply="${e.id}" data-reply-action="${esc(a.id)}"><h4>${esc(a.label)}</h4>${(a.fields||[]).map(field=>`<label>${esc(field.label)}${field.type==='select'?`<select name="${esc(field.id)}">${field.options.map(opt=>`<option value="${esc(opt)}">${esc(opt)}</option>`).join('')}</select>`:field.type==='textarea'?`<textarea name="${esc(field.id)}" maxlength="2000"></textarea>`:`<input name="${esc(field.id)}" maxlength="2000">`}</label>`).join('')}<button class="solid" type="submit">${esc(a.label)}</button></form>`:`<button type="button" class="interaction-link" data-interaction-link="${e.id}" data-link-action="${esc(a.id)}">${esc(a.label)} ↗</button>`).join(''):'<p class="fineprint">This interaction can no longer be answered.</p>'}</div>`;
}
function settings(){
 return renderSettings({
  page:state.settingsPage,profile:state.profile,origin:state.api?.origin,sessionRemembered:state.sessionRemembered,
  theme:state.theme,notifyPrefs:state.notifyPrefs,pushPrefs:state.pushPrefs,pushPermission:state.pushPermission,
  pushLabel:backgroundPushState().label,mute:state.mute,platform:clientPlatform,nativeApp:isTauri(),clientVersion:CLIENT_VERSION,
  updateInfo,updateChecked,updateError,androidStatus:androidUpdateStatus,companionVersion:REVIEWED_COMPANION.version,
  recoveryCodes:state.recoveryCodes,recoveryMessage:state.recoveryMessage,developerAllowed:state.developerAllowed,
  developerVisible:state.developerVisible
 });
}
function developerPanel(){
 if(!state.developerAllowed || !state.developerVisible) return settings();
 const info=state.developerInfo;
 const status=state.developerError?`<p class="dev-error" role="alert">${esc(state.developerError)}</p>`:'';
 const count=(label,value)=>`<div class="dev-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
 return `<section class="utility dev-panel"><div class="dev-head"><div><h2>Admin / Debug</h2><p>Authorized diagnostics for this Social component. Read-only; no LoopRD administrator access.</p></div><button data-action="developer-refresh">↻ Refresh</button></div>
 <div class="dev-stats">
 ${count('Social connection',state.connected?'connected':'offline')}
 ${count('LoopRD server',state.api?.origin||'—')}
 ${count('Client app',CLIENT_VERSION)}${count('Social release',info.release)}
 ${count('WebSocket',state.pulseState)}
 ${count('Last client sync',state.lastSyncAt?new Date(state.lastSyncAt).toLocaleString():'Not yet')}
 ${count('Configured games',config.games.length)}
 ${count('Atrium discovery',state.atriumDiscoveryStatus)}
 ${count('Atrium titles',state.atriumGames.length)}
 ${count('Atrium launcher',state.atriumUrl?'configured':'not configured')}
 ${count('Game API failures',Object.keys(state.gameErrors).length)}
 </div>
 <h3>Integrations</h3><p class="fineprint">Atrium discovery displays reviewed metadata only. Game launch requires separate approval and player authorization. Service credentials and private API URLs are never exposed to Tavi.</p><h3>Server diagnostics</h3>${status}
 ${info?`<div class="dev-stats">
 ${count('Component',info.component)}${count('Release',info.release)}${count('Platform API',info.apiVersion)}
 ${count('Social schema',info.databaseSchemaVersion)}${count('Server time',new Date(info.serverTime*1000).toLocaleString())}
 ${Object.entries(info.counts).map(([key,value])=>count(key,value)).join('')}
 </div><p class="fineprint">Available capabilities: ${esc(info.features.join(', '))}</p>`:'<p class="fineprint">Use Refresh to retrieve permitted server diagnostics.</p>'}
 <p class="fineprint">Passwords, session tokens, direct messages, environment variables and LoopRD management keys are never returned by this endpoint.</p>
 </section>`;
}
function updateDeveloperPermission(me){
 const allowed=me?.permissions?.developer===true;
 state.developerAllowed=allowed;
 if(!allowed){state.developerVisible=false;state.developerInfo=null;state.developerError='';if(state.panel==='developer')state.panel='settings';}
}
async function updateDeveloperInfo(){
 if(!state.api||!state.developerAllowed||!state.developerVisible)return;
 const api=state.api;
 try {const info=await api.developerDiagnostics();if(state.api===api) {state.developerInfo=info;state.developerError='';}}
 catch(e){if(state.api!==api)return;state.developerInfo=null;state.developerError=e.message;
   if(e.status===403||/DEVELOPER_ACCESS_DENIED/.test(e.message)) {state.developerAllowed=false;state.developerVisible=false;state.developerError='';if(state.panel==='developer')state.panel='settings';}}
}
function homeProfile(){
 const display=state.profile?.displayName||state.profile?.username||'You';
 const p=state.companion,pet=p?.enabled?petById(p.petId):null;
 return `<section class="tavi-home-profile"><button type="button" class="tavi-home-avatar" data-action="portrait" aria-label="Edit your portrait">${avatar(display,true)}</button><div class="tavi-home-identity"><strong>${esc(display)}</strong><span><span class="presence online"></span>Online</span><small>Your friends and games, together</small></div><button type="button" class="tavi-home-badges" data-action="inbox" aria-label="View your notifications">${uiGlyph('bell')}<small>Activity</small></button><button type="button" class="tavi-home-pet" data-action="companion" aria-label="Open your companion">${pet?petSprite(pet,{small:true}):'<span aria-hidden="true">♡</span>'}<small>${esc(pet?p.name:'My pet')}</small></button></section>`;
}
function homeConversations(){
 const accepted=state.contacts.filter(c=>c.status==='accepted');
 const recent=state.conversationSummaries.filter(x=>x.latest).map(x=>accepted.find(c=>c.id===x.peer)).filter(Boolean);
 const combined=[...recent,...accepted.filter(c=>!recent.includes(c))].slice(0,6);
 return `<section class="tavi-home-section"><div class="tavi-section-title"><h2>Recent conversations</h2><button type="button" data-action="contacts">All contacts →</button></div><div class="tavi-home-threads">${combined.length?combined.map(peer=>{
   const summary=state.conversationSummaries.find(x=>x.peer===peer.id),unread=state.unread[peer.id]||0;
   const preview=summary?.latest?(state.notifyPrefs.preview?String(summary.latest.text).slice(0,90):'New message · open to read'):(peer.online?'Online now':'Offline');
   return `<button type="button" class="tavi-home-thread" data-peer="${esc(peer.id)}" data-contact-name="${esc(peer.username.toLowerCase())}">${avatar(peer.username,peer.online)}<span class="tavi-home-thread-copy"><strong>${esc(peer.displayName||peer.username)}</strong><small>${esc(preview)}</small></span>${unread?`<span class="unread-badge">${unread>99?'99+':unread}</span>`:''}</button>`;
 }).join(''):'<p class="tavi-home-empty">Add a friend to begin chatting and playing together.</p>'}</div></section>`;
}
function homeMinimized(compact=false){
  const entries=surfaces.list();
  if(compact&&entries.length)return `<section class="tavi-roster-activities" aria-label="Minimized activities"><div class="roster-label"><strong>Open chats &amp; games</strong></div><div class="tavi-roster-activity-list">${entries.map(item=>`<button type="button" data-resume-surface="${esc(item.id)}" title="Resume ${esc(item.title)}"><span aria-hidden="true">${uiGlyph(item.kind==='game'?'games':'messages')}</span><span>${esc(item.title)}</span></button>`).join('')}</div></section>`;

 return entries.length?`<section class="tavi-home-section tavi-resume-section" aria-label="Minimized activities"><div class="tavi-section-title"><h2>Open activities</h2></div><div class="tavi-resume-icons">${entries.map(item=>`<button type="button" data-resume-surface="${esc(item.id)}" aria-label="Resume ${esc(item.title)}"><span aria-hidden="true">${uiGlyph(item.kind==='game'?'games':'messages')}</span><span>${esc(item.title)}</span>${item.unread?`<b>${item.unread}</b>`:''}</button>`).join('')}</div></section>`:'';
}
function launcherTile(item){
 const id=item.kind==='extension'?`data-extension-open="${esc(item.id)}"`:`data-action="${esc(item.action)}"`;
 let iconUrl=null;
 if(item.kind==='extension'){
  try{iconUrl=extensionIconUrl(item.entry,extensionBase());}catch{iconUrl=null;}
 }
 const icon=iconUrl?`<img class="tavi-app-icon-image" src="${esc(iconUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'';
 return `<button type="button" class="tavi-app-tile" ${id} aria-label="Open ${esc(item.label)}"><span class="tavi-app-icon tone-${esc(item.tone)}">${appGlyph(item.symbol)}${icon}</span><span class="tavi-app-caption">${esc(item.label)}</span></button>`;
}
function mainMenu(){
 const apps=menuApplications({catalog:extensionCatalog,store:extensionAccountStore(),platform:clientPlatform,petEnabled:state.companion?.enabled});
 const sections=[{label:'Talk',ids:['contacts','inbox','add-friend']},{label:'Explore',ids:['games','companion','portrait']},{label:'Your apps',ids:['wallet','app-store','settings']}];
 const groups=sections.map((group,i)=>({...group,apps:apps.filter(a=>group.ids.includes(a.action) || (i===2&&a.kind==='extension'))}));
 return `<section class="utility tavi-menu-panel" aria-label="Tavi apps"><div class="tavi-launcher-header"><h2>Your apps</h2><span class="tavi-launcher-count">${apps.length} available</span></div><nav class="tavi-app-page-tabs" aria-label="App categories">${groups.map((group,i)=>`<button type="button" data-app-page="${i}" aria-selected="${i===0?'true':'false'}" tabindex="${i===0?'0':'-1'}">${esc(group.label)}</button>`).join('')}</nav><div class="tavi-app-pages" role="region" aria-label="Swipe between app categories">${groups.map(group=>`<section class="tavi-app-page" aria-label="${esc(group.label)}"><h3>${esc(group.label)}</h3><div class="tavi-menu-grid">${group.apps.map(launcherTile).join('')}</div></section>`).join('')}</div><p class="tavi-launcher-footer">Swipe between categories · <button type="button" data-action="app-store">App Store</button></p></section>`;
}
function homeScreen(){
 // Home owns the classic buddy list and profile/Companion strip; the host owns chrome.
 return `<main class="tavi-home tavi-unified-roster" aria-label="Tavi Home">${homeContactPane()}</main>`;
}
function dashboard(){
 // Home and Messages own different content; focused conversations
 // and games deliberately surrender the remaining viewport to their content.
 if(state.panel==='home')return `<div class="tavi-single-workspace tavi-unified-home">${homeToolbar()}${homeScreen()}${mobileTabs('home',{unread:unreadTotal()})}</div>`;
 const chatting=state.panel==='messenger';
 if(nativeDesktop&&chatting)return `<div class="tavi-single-workspace tavi-contact-focus">${hostToolbar('Messages',{action:'back',backLabel:'Home'})}${messageInbox()}${mobileTabs('messenger',{unread:unreadTotal()})}</div>`;
 if(!nativeDesktop&&chatting&&state.mobileRoster)return `<div class="tavi-single-workspace tavi-contact-focus">${hostToolbar('Messages',{action:'back',backLabel:'Home'})}${messageInbox()}${mobileTabs('messenger',{unread:unreadTotal()})}</div>`;
 if(!nativeDesktop&&chatting)return `<div class="tavi-single-workspace tavi-chat-focus">${focusedConversation()}</div>`;
 const content=state.panel==='app-store'?appStorePanel():state.panel==='extension'?extensionPanel():state.panel==='menu'?mainMenu():state.panel==='add-friend'?addFriend():state.panel==='inbox'?inbox():state.panel==='games'?gameSettings():state.panel==='companion'?companion():state.panel==='portrait'?portrait():state.panel==='settings'?settings():developerPanel();
 const utilityTitle=state.panel==='settings'?settingsPageTitle(state.settingsPage):({games:'Games',inbox:'Notifications',portrait:'Your portrait',companion:'My pet',developer:'Developer tools',menu:'Main menu','app-store':'App Store',extension:extensionEntry(extensionSelected)?.manifest?.name||'App'})[state.panel]||'Tavi';
 const settingsBack=state.panel==='settings'&&state.settingsPage!=='root'?'Settings':'Home';
 return `<div class="tavi-single-workspace tavi-utility-focus"><section class="classic-window auxiliary-window">${hostToolbar(utilityTitle,{action:'back',backLabel:settingsBack})}<div class="aux-content">${content}</div></section>${mobileTabs(state.panel,{unread:unreadTotal()})}</div>`;
}
// Native floating pet has no Social token or access to application APIs. The
// authenticated main window mediates all care actions and account persistence.
let petBridgeReady=false,petWindowPending=false;
const petWindowPositionKey=()=>state.companionKey?state.companionKey+'.floatingPosition':null;
async function sendPetSnapshot(){const snapshot=petWindowSnapshot(state.companion);if(snapshot)await emitTo(PET_WINDOW_LABEL,'tavi-companion-state',snapshot).catch(()=>{});}
async function initializePetBridge(){
 if(!nativeWindowsPet||petBridgeReady)return;
 petBridgeReady=true;
 await listen('tavi-companion-request',async ({payload})=>{
   const cmd=parsePetWindowCommand(payload);
   if(!cmd||!canShowFloating(state.companion,{windows:true,authenticated:!!state.api}))return;
   if(cmd==='ready'){await sendPetSnapshot();return;}
   if(cmd==='hide'){changePet(p=>updatePreferences(p,{overlay:'off'}));return;}
   if(cmd==='open'){state.panel='companion';state.mobileRoster=false;render();await getCurrentWindow().setFocus().catch(()=>{});return;}
   if(cmd==='reset-position'){try{localStorage.removeItem(petWindowPositionKey());const w=await WebviewWindow.getByLabel(PET_WINDOW_LABEL);await w?.center();}catch{}return;}
   if(['feed','clean','play','rest','pet'].includes(cmd))changePet(p=>performCare(p,cmd));
 });
 await listen('tavi-companion-moved',({payload})=>{
   const point=normalizePetPosition(payload),key=petWindowPositionKey();
   if(key&&point&&canShowFloating(state.companion,{windows:true,authenticated:!!state.api})){
     try{localStorage.setItem(key,JSON.stringify(point));}catch{}
   }
 });
}
async function closePetWindow(){if(!nativeWindowsPet)return;
 try{const w=await WebviewWindow.getByLabel(PET_WINDOW_LABEL);if(w)await w.close();}catch{}
}
async function reconcilePetWindow(){
 if(!nativeWindowsPet)return;
 if(!canShowFloating(state.companion,{windows:true,authenticated:!!state.api}))return closePetWindow();
 await initializePetBridge();
 try{
   const existing=await WebviewWindow.getByLabel(PET_WINDOW_LABEL);
   if(existing){await sendPetSnapshot();return;}
   if(petWindowPending)return;
   petWindowPending=true;
   const windowHandle=new WebviewWindow(PET_WINDOW_LABEL,{url:'companion.html',title:'Tavi Companion',
     width:PET_SIZE.width,height:PET_SIZE.height,minWidth:PET_SIZE.width,minHeight:PET_SIZE.height,
     resizable:false,decorations:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,center:true,focus:false});
   windowHandle.once('tauri://created',async()=>{
     petWindowPending=false;
     if(!canShowFloating(state.companion,{windows:true,authenticated:!!state.api}))return closePetWindow();
     try{const saved=JSON.parse(localStorage.getItem(petWindowPositionKey())||'null');
       const point=normalizePetPosition(saved);
       if(point)await windowHandle.setPosition(new PhysicalPosition(point.x,point.y));}catch{}
     await sendPetSnapshot();
   });
   windowHandle.once('tauri://error',e=>{petWindowPending=false;toast('Could not create desktop companion: '+String(e.payload));});
 }catch(error){petWindowPending=false;toast('Could not create desktop companion: '+error.message);}
}
function changePet(change){if(!state.connected||!state.companionKey)return;try{state.companion=change(state.companion);saveCompanion(localStorage,state.companionKey,state.companion);render();void reconcilePetWindow();}catch(error){toast('Companion change unavailable: '+error.message);}}
function render(){
 if(state.panel!=='extension'&&pendingLifeLaunch)clearPendingLifeLaunch();
 if(state.panel!=='app-store'){extensionInstallApproval=null;extensionSwitchApproval=null;marketplaceSelected='';}
 // Keep an active sandbox frame mounted across chat/notification polling.
 // Moving an iframe through a detached DOM tree reloads it in some WebViews.
 const existingSlot=document.getElementById('tavi-extension-surface');
 if(state.panel==='extension'&&existingSlot?.dataset.extensionId===extensionSelected&&existingSlot.querySelector('iframe')){
  document.title=unreadTotal()?`(${unreadTotal()}) Tavi`:'Tavi';
  let notice=document.querySelector('body > .toast');
  if(state.toast){if(!notice){notice=document.createElement('div');notice.className='toast';notice.setAttribute('role','status');document.body.append(notice);}notice.textContent=state.toast;}
  else notice?.remove();
  return;
 }
 document.querySelector('body > .toast')?.remove();if(state.panel!=='settings')state.recoveryCodes=null;const entry=document.getElementById('message');if(entry&&document.activeElement===entry)state.draft=entry.value;const oldFrame=document.getElementById('portrait-frame');const oldExtensionFrame=document.querySelector('#tavi-extension-surface iframe');if(oldExtensionFrame)oldExtensionFrame.remove();const filter=document.getElementById('roster-filter');const search=filter?.value||'';const focused=document.activeElement===entry?{start:entry.selectionStart,end:entry.selectionEnd}:null;const settingsScroll=document.querySelector('.aux-content')?.scrollTop||0;const oldScroll=document.getElementById('chat-scroll');const nearBottom=!oldScroll||oldScroll.scrollHeight-oldScroll.scrollTop-oldScroll.clientHeight<90;const oldTop=oldScroll?.scrollTop;document.title=unreadTotal()?`(${unreadTotal()}) Tavi`:'Tavi';applyTheme();app.innerHTML=(!state.connected&&!nativeDesktop?header():'')+(state.connected?dashboard():signIn())+(state.toast?`<div class="toast" role="status">${esc(state.toast)}</div>`:'')+(state.connected?companionBadge(state.companion):'')+(state.connected?extensionInstallDialog():'');if(oldFrame&&state.panel==='portrait')document.getElementById('portrait-frame')?.replaceWith(oldFrame);attachExtensionFrame(oldExtensionFrame);wire();const newSettings=document.querySelector('.aux-content');if(newSettings&&state.panel==='settings')newSettings.scrollTop=settingsScroll;const newFilter=document.getElementById('roster-filter');if(newFilter){newFilter.value=search;applyContactFilter(search);}if(focused){const field=document.getElementById('message');if(field){field.focus();field.setSelectionRange(focused.start,focused.end);}}if(state.panel==='messenger'){const scroll=document.getElementById('chat-scroll');if(scroll){scroll.scrollTop=nearBottom?scroll.scrollHeight:oldTop;}}}
function applyContactFilter(query){const term=query.trim().toLowerCase();document.querySelectorAll('[data-contact-name]').forEach(node=>{node.hidden=!!term&&!node.dataset.contactName.includes(term);});}
function stop(){extensionInstallApproval=null;clearPendingLifeLaunch();++extensionRepoLoad;extensionSuggested=[];extensionRepoStatuses=[];repositoryChecks=[];diagnosticEvents.clear();extensionHost.unmount();extensionSelected='';extensionCatalog=[];extensionCatalogError='';extensionStore=null;extensionStoreScope='';coreWalletEntry=null;extensionVerified=new Set();state.goldAmount=null;state.goldStatus='loading';state.goldLastCheckedAt=0;extensionLastCheckedAt=0;extensionStaleSources=new Set();if(extensionUpdatePoll){clearInterval(extensionUpdatePoll);extensionUpdatePoll=null;}void closePetWindow();for(const label of nativeChildLabels){void WebviewWindow.getByLabel(label).then(w=>w?.close()).catch(()=>{});}nativeChildLabels.clear();mailboxWake?.close();mailboxWake=null;sessionRetry.disable();state.retryAvailable=false;state.retryOrigin='';if(pulse){pulse.onclose=null;pulse.close();pulse=null;}clearInterval(poll);poll=null;state.api=null;state.connected=false;state.companion=newCompanion();state.companionKey=null;state.profile=null;state.lobby=[];state.direct=[];state.contacts=[];state.avatarCode='';state.gameTokens.clear();state.turns=[];state.gameRooms=[];state.selectedRoomId=null;state.roomMessages=[];state.roomError='';state.interactions=[];state.selectedInteraction=null;state.interactionError='';state.catalog=[];state.catalogError='';state.atriumGames=[];state.atriumDiscoveryStatus='not_connected';state.lastCatalogAt=0;state.draft='';state.developerAllowed=false;state.developerVisible=false;state.developerInfo=null;state.developerError='';state.lastSyncAt=null;state.pulseState='disconnected';state.chatRead={};state.unread={};state.peerFeeds.clear();state.chatOffset=0;state.conversationSummaries=[];state.summarySupported=null;state.pendingAcks.clear();state.peerReceipts.clear();state.pendingRequestIds=null;state.notifyPrefs={messages:true,preview:false,requests:true};state.pushPrefs={backgroundEnabled:false};state.pushCapability=null;state.atriumUrl=null;state.pushPermission='unknown';state.step='server';state.panel='home';state.mobileRoster=true;surfaces.clear();closeEmbeddedGame();render();}
async function activate(api){const me=await api.me();if(!me?.profile?.profileId)throw Error('Social did not return your profile');stop();await closePetWindow();state.api=api;state.connected=true;state.profile=me.profile;state.goldAmount=null;state.goldStatus='loading';state.goldLastCheckedAt=0;try{state.companionKey=storageKey(api.origin,me.profile.profileId);state.companion=loadCompanion(localStorage,state.companionKey);}catch{state.companionKey=null;state.companion=newCompanion();}state.revision=me.revision;void reconcilePetWindow();updateDeveloperPermission(me);state.avatarCode=me.profile.portraitCode||'';selectServerGames(config,api.origin);writeConfig(config);state.peer='lobby';state.panel='home';state.mobileRoster=true;try{state.chatRead=loadChatReadState(localStorage,readKey());state.notifyPrefs=loadNotificationPrefs(localStorage,notificationPrefsKey(api.origin,me.profile.profileId));state.pushPrefs=readPushPreferences(localStorage,pushKey());}catch{}render();void loadExtensionStore();void refreshGoldBalance(api);extensionUpdatePoll=setInterval(()=>{if(state.api===api&&navigator.onLine!==false)void loadExtensionStore();},EXTENSION_CHECK_INTERVAL);void refreshPushReadiness();await loadCatalog();await refresh();mailboxWake=createWakeCoordinator(()=>refresh({mailboxOnly:true}),{isBusy:()=>polling});startPulse();poll=setInterval(()=>{void refresh();void refreshGoldBalance(api);if(Date.now()-state.lastCatalogAt>=60000)void loadCatalog();},25000);}
async function refresh({mailboxOnly=false}={}){if(!state.api||polling)return;polling=true;try{const api=state.api;
 if(!mailboxOnly){const me=await api.me();if(api!==state.api)return;updateDeveloperPermission(me);}
 const needLobby=!mailboxOnly||state.peer==='lobby'&&!nativeDesktop;
 const [lobby,contacts]=await Promise.all([needLobby?api.feed():Promise.resolve(null),api.contacts()]);if(api!==state.api)return;
 state.lastSyncAt=Date.now();
 if(!mailboxOnly&&state.developerVisible && state.panel==='developer')await updateDeveloperInfo();
 if(lobby)state.lobby=lobby.messages||[];state.contacts=contacts.contacts||[];await synchronizeMailbox(api);if(api!==state.api)return;
 const incoming=state.contacts.filter(c=>c.status==='pending'&&c.direction==='incoming').map(c=>c.id);
 if(state.pendingRequestIds!==null&&!state.mute&&state.notifyPrefs.requests){for(const c of state.contacts){if(incoming.includes(c.id)&&!state.pendingRequestIds.includes(c.id))void notifyFriendRequest(c.username);}}
 state.pendingRequestIds=incoming;
 try {const result=await api.interactions();if(api===state.api)state.interactions=result.events||[];state.interactionError='';}catch(e){state.interactionError='Interactive inbox unavailable: '+e.message;}
 if(state.peer!=='lobby'&&activePeer()?.status==='accepted'){const messages=state.peerFeeds.get(state.peer);state.direct=messages||[];}
 else state.direct=[];
 if(!mailboxOnly || state.panel==='games'){
  try {
   const rooms=await api.gameRooms();if(api!==state.api)return;
   state.gameRooms=rooms.rooms||[];
   if(!state.gameRooms.some(r=>r.roomId===state.selectedRoomId)){
     state.selectedRoomId=null;state.roomMessages=[];
   }
   if(state.selectedRoomId){
     const feed=await api.gameRoomFeed(state.selectedRoomId);
     if(api!==state.api)return;
     state.roomMessages=feed.messages||[];
   }
   state.roomError='';
  }catch(e){if(api!==state.api)return;state.gameRooms=[];state.selectedRoomId=null;state.roomMessages=[];
    state.roomError=/Unknown operation/.test(e.message)?'Match chat requires a newer Tavi Social server.':e.message;}
 }
 if(mailboxOnly){render();return;}
 let turns=[],errors={};for(const game of config.games){try{const {turns:feed}=await gameActivity(api.origin,game,state.gameTokens.get(game)||'');const active=feed.map(x=>({...x,game}));turns.push(...active);const key=seenStorageKey(api.origin,game,state.profile.profileId);const saved=previousTurnKeys(localStorage,key);const {newIds,activeIds}=newTurnKeys(active,saved);for(const id of newIds)if(!state.mute){const t=active.find(x=>x.id===id);await notifyTurn('Your turn · '+game,t.title);}localStorage.setItem(key,JSON.stringify(activeIds));}catch(error){errors[game]=error.message;}}
 if(api===state.api){state.turns=turns;state.gameErrors=errors;render();}
 }catch(error){if(state.api)toast('Sync failed: '+error.message);}finally{polling=false;}}
/** Server-side summaries remove the O(number-of-friends) polling cost. On an
 * older server, preserve the v0.3.17 bounded scanner until it is upgraded.
 */
async function synchronizeMailbox(api){
 if(state.summarySupported!==false){
  try{
   const response=await api.conversations();
   if(response.schema!=='tavi.dm-summaries/v1'||!Array.isArray(response.conversations)||response.conversations.length>500)
     throw Error('Invalid conversation summary response');
   state.summarySupported=true;
   const accepted=new Set(state.contacts.filter(c=>c.status==='accepted').map(c=>c.id));
   state.conversationSummaries=[];
   const migrate=[];
   const nextUnread={};
   for(const item of response.conversations){
    if(!accepted.has(item.peer))continue;
    const old=state.chatRead[item.peer];
    const result=reconcileConversationSummary(item,state.profile.profileId,old,{visible:false});
    state.chatRead[item.peer]=result.cursor;
    nextUnread[item.peer]=result.unread;
    state.conversationSummaries.push(item);rememberPeerReceipts(item.peer,item);
    if(old?.read>item.readId)migrate.push({peer:item.peer,id:old.read});
    if(result.notification&&!state.mute&&state.notifyPrefs.messages)
     void notifyChat(nameOf(item.peer),result.notification.text,{preview:state.notifyPrefs.preview});
   }
   state.unread=nextUnread;storeRead();
   // Migration of existing local read markers is bounded to avoid flooding the server.
   for(const {peer,id} of migrate.slice(0,20))void pushRead(api,peer,id);
   // Use the full DM feed only for the conversation currently in view.
   if(state.peer!=='lobby'&&activePeer()?.status==='accepted'){
    const result=await api.directFeed(state.peer);
    if(api!==state.api)return;
    state.peerFeeds.set(state.peer,result.messages||[]);rememberPeerReceipts(state.peer,result);
    if(peerVisible(state.peer))markRead(state.peer,result.messages||[]);
   }
   return;
  }catch(e){
   if(api!==state.api)return;
   if(e.message==='Unknown operation'){
    state.summarySupported=false;state.conversationSummaries=[];
   }else{throw e;}
  }
 }
 await scanDirectMessages(api);
}
/** Poll accepted contacts in a rotating bounded batch. The current Social API has no
 * mailbox-summary endpoint, so this works while the client is active and never
 * sends more than 12 per-contact DM feed requests in a scan (+ active chat).
 */
async function scanDirectMessages(api){
 const batch=chatPollPeers(state.contacts,state.chatOffset,12);
 state.chatOffset=batch.nextOffset;
 const peers=[...batch.peers];
 if(state.peer!=='lobby'&&activePeer()?.status==='accepted'&&!peers.some(p=>p.id===state.peer))peers.push(activePeer());
 const results=await Promise.allSettled(peers.map(p=>api.directFeed(p.id)));
 if(api!==state.api)return;
 let dirty=false;
 for(let i=0;i<peers.length;i++){
  const result=results[i];if(result.status!=='fulfilled'||!Array.isArray(result.value?.messages))continue;
  const peer=peers[i],messages=result.value.messages;
  state.peerFeeds.set(peer.id,messages);rememberPeerReceipts(peer.id,result.value);
  const visible=peerVisible(peer.id);
  const prior=state.chatRead[peer.id];
  const reconciled=reconcileDirectFeed(messages,state.profile.profileId,prior,{visible});
  state.chatRead[peer.id]=reconciled.cursor;
  state.unread[peer.id]=reconciled.unread;
  dirty=true;
  if(reconciled.notification&&!state.mute&&state.notifyPrefs.messages){
   void notifyChat(peer.username,reconciled.notification.text,{preview:state.notifyPrefs.preview});
  }
 }
 if(dirty)storeRead();
}
const resumeForeground=createResumeSync(()=>refresh(),{minIntervalMs:4000});
document.addEventListener('visibilitychange',()=>resumeForeground({signedIn:!!state.api,visible:document.visibilityState==='visible'}));
globalThis.addEventListener?.('focus',()=>resumeForeground({signedIn:!!state.api,visible:document.visibilityState!=='hidden'}));
// Future Android UnifiedPush distributor plugin may forward a *content-free*
// wake hint through this trusted local event. The only operation is to ask the
// currently authenticated Social server for fresh state. No token in payload.
const pushWakeup=createPushWakeupBridge(()=>mailboxWake?.wake());
if(clientPlatform==='android')void listen('tavi-push-wakeup',e=>pushWakeup(e.payload,{signedIn:!!state.api})).catch(()=>{});
function startPulse(){const api=state.api;let delay=1000;const open=async()=>{if(state.api!==api)return;let ws;try{const ticket=await api.pulseTicket();if(state.api!==api)return;ws=new WebSocket(api.pulseUrl()+'?ticket='+encodeURIComponent(ticket));}catch{state.pulseState='reconnecting';if(state.api===api)setTimeout(open,delay);delay=Math.min(delay*2,30000);return;}pulse=ws;state.pulseState='connecting';ws.onopen=()=>{state.pulseState='connected';delay=1000;ws.send(JSON.stringify({subscribe:'pulses'}));};ws.onmessage=e=>{try{if(JSON.parse(e.data).resource==='pulses')mailboxWake?.wake();}catch{}};ws.onclose=()=>{state.pulseState='reconnecting';if(state.api===api){setTimeout(open,delay);delay=Math.min(delay*2,30000);}};};open();}
async function loadCatalog(){
 if(!state.api)return;
 const api=state.api;
 const [legacy,atrium]=await Promise.allSettled([discoverGames(api.origin),discoverAtriumGames(api)]);
 if(state.api!==api)return;
 state.lastCatalogAt=Date.now();
 if(legacy.status==='fulfilled'){state.catalog=legacy.value;state.catalogError='';}
 else{state.catalog=[];state.catalogError='Game library unavailable: '+(legacy.reason?.message||'Connection failed');}
 if(atrium.status==='fulfilled'){
  state.atriumGames=atrium.value.games;
  state.atriumDiscoveryStatus=atrium.value.status;
 }else{
  state.atriumGames=[];
  state.atriumDiscoveryStatus='unavailable';
 }
 render();
}
let nativeGameBridgeReady=false;
async function initializeGameBridge(){
 if(!nativeDesktop||nativeGameBridgeReady)return;
 nativeGameBridgeReady=true;
 await listen('tavi-game-request',async e=>{
  const {label,gameId,kind,text,requestId}=e.payload||{};
  if(!/^[a-z][a-z0-9-]{1,47}$/.test(gameId||'')||label!=='game-'+gameId||!Number.isSafeInteger(requestId))return;
  try{
   const game=state.catalog.find(x=>x.id===gameId&&x.embedded);
   if(!state.api||!game)throw Error('Game is not published for this server.');
   if(kind==='send'){
    if(typeof text!=='string'||!text.trim()||text.length>320)throw Error('Invalid lobby message.');
    await state.api.send(text.trim());
   }else if(kind!=='snapshot')throw Error('Unsupported game action');
   const feed=await state.api.feed();
   await emitTo(label,'tavi-game-response',{requestId,ok:true,snapshot:{game,server:new URL(state.api.origin).host,messages:(feed.messages||[]).slice(-40)}});
  }catch(err){await emitTo(label,'tavi-game-response',{requestId,ok:false,error:err.message||'Game error'}).catch(()=>{});}
 });
}
let embeddedGame=null;
function closeEmbeddedGame(){if(embeddedGame?.root)embeddedGame.root.remove();embeddedGame=null;}
function showEmbeddedGame(game){
 if(!game?.embedded)return;
 if(embeddedGame&&embeddedGame.id!==game.id)closeEmbeddedGame();
 if(!embeddedGame){
  const root=document.createElement('section');root.className='tavi-embedded-game';root.setAttribute('aria-label',game.name+' game');
  root.innerHTML=`<header class="tavi-game-controls"><strong>${esc(game.name)}</strong><button type="button" class="tavi-game-minimize" aria-label="Minimize game to Home">− Minimize</button></header><div class="tavi-game-stage"></div>`;
  const frame=document.createElement('iframe');frame.title=game.name;frame.referrerPolicy='no-referrer';frame.setAttribute('sandbox','allow-scripts allow-forms allow-same-origin allow-popups');frame.src=game.url;
  root.querySelector('.tavi-game-stage').append(frame);
  root.querySelector('.tavi-game-minimize').addEventListener('click',()=>{
   root.hidden=true;surfaces.minimizeGame(game.id,game.name);state.panel='home';state.mobileRoster=true;render();
  });
  document.body.append(root);embeddedGame={id:game.id,root};
 }
 embeddedGame.root.hidden=false;surfaces.activate('game:'+game.id);
}
let surfaceBridgeReady=false;
async function initializeSurfaceBridge(){
 if(!nativeDesktop||surfaceBridgeReady)return;
 surfaceBridgeReady=true;
 await listen('tavi-surface-minimize',async e=>{
  const {kind,id}=e.payload||{};
  if(!safeSurfaceId(kind,id))return;
  const label=kind==='game'?'game-'+id:chatWindowLabel(id);
  try{
   const target=await WebviewWindow.getByLabel(label);
   if(!target)return;
   await target.hide();
   const title=kind==='game'?state.catalog.find(g=>g.id===id)?.name:id==='lobby'?'Community Lobby':nameOf(id);
   surfaces.minimize(kind,id,title||id);
   state.panel='home';state.mobileRoster=true;render();await getCurrentWindow().setFocus().catch(()=>{});
  }catch(err){toast('Could not minimize window: '+err.message);}
 });
}
async function resumeSurface(surfaceId){
 const item=surfaces.get(surfaceId);if(!item)return;
 if(!nativeDesktop&&item.kind==='game'){
  const game=state.catalog.find(g=>g.id===item.value&&g.embedded);
  if(game&&embeddedGame?.id===game.id){showEmbeddedGame(game);return;}
  surfaces.remove(surfaceId);render();return toast('This game is no longer open.');
 }
 if(nativeDesktop){
  const label=item.kind==='game'?'game-'+item.value:chatWindowLabel(item.value);
  const win=await WebviewWindow.getByLabel(label).catch(()=>null);
  if(!win){surfaces.remove(surfaceId);render();return toast('That window has closed.');}
  try{await win.show();await win.setFocus();surfaces.activate(surfaceId);}catch(err){toast('Could not restore window: '+err.message);}
  render();return;
 }
 if(item.kind==='chat'){
  state.panel='messenger';state.peer=item.value;state.mobileRoster=false;surfaces.activate(surfaceId);
  state.direct=item.value==='lobby'?[]:state.peerFeeds.get(item.value)||[];render();void refresh();
 }
}
async function launchPromoted(id,embedded){
 const game=state.catalog.find(g=>g.id===id);if(!game)return toast('Game no longer published by server.');
 if(!embedded||!game.embedded){return openExternalGame(game.url);}
 if(!nativeDesktop){showEmbeddedGame(game);return;}
 try{
  await initializeGameBridge();
  const label='game-'+id;
  const prior=await WebviewWindow.getByLabel(label);
  if(prior){await prior.show();await prior.setFocus();surfaces.activate('game:'+id);return;}
  nativeChildLabels.add(label);
  const windowHandle=new WebviewWindow(label,{url:'game.html?game='+encodeURIComponent(id),title:game.name+' — Tavi',width:1100,height:730,minWidth:650,minHeight:480,resizable:true,center:true});
  windowHandle.once('tauri://error',e=>toast('Game window failed: '+String(e.payload)));
 }catch(e){toast('Unable to open game: '+e.message);}
}
async function openExternalGame(url){try{if(isTauri())await openUrl(url);else window.open(url,'_blank','noopener,noreferrer');}catch(e){toast('Could not open game: '+e.message);}}
async function openGame(path){if(!state.api||!path)return;const url=state.api.origin+path;try{if(isTauri())await openUrl(url);else window.open(url,'_blank','noopener,noreferrer');}catch{toast('Could not open game.');}}
// User-initiated, local-only diagnostic report. Never serialize application state,
// network payloads, message content, credentials, usernames or storage values.
function diagnosticReport(){
 const safeCount=v=>Array.isArray(v)?v.length:0;
 const extensionRows=extensionCatalog.map(entry=>{
  const id=entry?.manifest?.id||'unknown';
  const store=extensionAccountStore();
  return {id,version:entry?.manifest?.version||'unknown',installedVersion:store?.version(id)||null,installed:!!store?.version(id),enabled:!!store?.enabled(id),updateStatus:extensionStaleSources.has(entry.repositoryUrl)?'unavailable':extensionUpdateStatus(entry,store),sourceType:entry.remote?'repository':'bundled',alternativeSourceVersion:alternateStoreRelease(entry)?.manifest?.version||null};
 });
 const snapshot={schema:'tavi.client-diagnostics/v1',generatedAt:new Date().toISOString(),
  client:{version:CLIENT_VERSION,platform:clientPlatform,nativeShell:isTauri(),userAgent:navigator.userAgent,
   viewport:{width:innerWidth,height:innerHeight},online:navigator.onLine},
  navigation:{panel:state.panel,mobileRoster:state.mobileRoster,activeExtension:state.panel==='extension'?extensionSelected:null},
  connection:{connected:state.connected,stage:state.step,serverConfigured:!!config.server,
   pulseState:state.pulseState,revision:state.revision,lastSyncAt:state.lastSyncAt,
   accountPresent:!!state.profile,serverSupportsAccounts:state.serverSupportsAccounts},
  ui:{contactCount:safeCount(state.contacts),conversationCount:safeCount(state.conversationSummaries),
   turnCount:safeCount(state.turns),gameCount:safeCount(state.catalog),atriumGameCount:safeCount(state.atriumGames),
   inboxCount:safeCount(state.interactions),nativeChildWindowCount:nativeChildLabels.size},
  integrations:{atriumDiscoveryStatus:state.atriumDiscoveryStatus,atriumConfigured:!!state.atriumUrl,
   extensionCount:extensionRows.length,extensions:extensionRows,
   repositoryChecks:repositoryChecks.map(x=>({...x})),repositoryStatus:repositoryChecks.map(x=>({status:x.result,httpStatus:x.httpStatus||null})),extensionUpdates:{checkedAt:extensionLastCheckedAt||null,available:optionalUpdateSummary(extensionCatalog,extensionAccountStore(),{staleSources:extensionStaleSources}).count,unavailableRepositories:extensionStaleSources.size,alternativeSourceOffers:extensionCatalog.filter(entry=>!!alternateStoreRelease(entry)).length}},
  recentEvents:diagnosticEvents.snapshot(),
  notifications:{permission:state.pushPermission,pulse:state.pulseState,backgroundEnabled:!!state.pushPrefs?.backgroundEnabled},
  updates:{checked:updateChecked,availableVersion:updateInfo?.version||null},
  notes:'Counts and feature state only. No chats, usernames, server addresses, tokens, or private storage values are included.'};
 return JSON.stringify(snapshot,null,2);
}
function showDiagnosticReport(){
 document.getElementById('tavi-diagnostic-dialog')?.remove();
 const layer=document.createElement('div');layer.id='tavi-diagnostic-dialog';layer.className='tavi-diagnostic-overlay';
 const dialog=document.createElement('section');dialog.className='tavi-diagnostic-dialog';
 dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Tavi diagnostic report');
 const title=document.createElement('h2');title.textContent='Tavi diagnostics';
 const description=document.createElement('p');description.textContent='Review this local snapshot, then copy and paste it into your support conversation. It does not include messages, passwords, tokens, usernames or server addresses.';
 const report=document.createElement('textarea');report.readOnly=true;report.spellcheck=false;report.setAttribute('aria-label','Diagnostic JSON');report.value=diagnosticReport();
 const controls=document.createElement('div');controls.className='tavi-diagnostic-controls';
 const quick=document.createElement('button');quick.type='button';quick.textContent='Copy quick summary';
 quick.addEventListener('click',async()=>{const summary=diagnosticsQuickSummary(JSON.parse(report.value));try{await navigator.clipboard.writeText(summary);quick.textContent='Summary copied!';}catch{report.value=summary;report.focus();report.select();quick.textContent='Select all — copy manually (Ctrl+C)';}});
 const copy=document.createElement('button');copy.type='button';copy.textContent='Copy full diagnostics';
 copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(report.value);copy.textContent='Copied!';}catch{report.focus();report.select();copy.textContent='Select all — copy manually (Ctrl+C)';}});
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Refresh snapshot';refresh.addEventListener('click',()=>{report.value=diagnosticReport();copy.textContent='Copy diagnostics';});
 const close=document.createElement('button');close.type='button';close.textContent='Close';close.addEventListener('click',()=>layer.remove());
 controls.append(quick,copy,refresh,close);dialog.append(title,description,report,controls);layer.append(dialog);document.body.append(layer);
 report.focus();
 layer.addEventListener('click',event=>{if(event.target===layer)layer.remove();});
 layer.addEventListener('keydown',event=>{if(event.key==='Escape')layer.remove();});
}
// Unified host back policy: native Android gestures and visible Tavi controls
// take the same route. No browser history or exit/quit side effects.
function goBackInTavi(){
 if(state.panel==='app-store'&&extensionSwitchApproval){extensionSwitchApproval=null;render();return;}
 if(state.panel==='app-store'&&marketplaceSelected){marketplaceSelected='';render();return;}
 const focused=document.activeElement;
 const editable=focused?.matches?.('input,textarea,[contenteditable="true"]');
 if(shouldDismissKeyboard({isEditable:editable,viewportHeight:window.visualViewport?.height,
     layoutHeight:window.innerHeight})) {focused.blur();return;}
 if(state.connected&&state.panel==='settings'&&state.settingsPage!=='root'){
   state.settingsPage='root';state.recoveryCodes=null;render();return;
 }
 const outcome=decideHostBack({connected:state.connected,step:state.step,panel:state.panel,
   mobileRoster:state.mobileRoster,extensionReturnsHome:extensionReturnsHome(extensionSelected),
   installApproval:!!extensionInstallApproval,lifeLaunch:!!pendingLifeLaunch,
   diagnostics:!!document.querySelector('.tavi-diagnostic-overlay'),
   interactionDetail:state.selectedInteraction!==null});
 if(outcome==='close-diagnostics'){document.querySelector('.tavi-diagnostic-overlay')?.remove();return;}
 if(outcome==='cancel-install'){extensionInstallApproval=null;render();return;}
 if(outcome==='cancel-life-launch'){clearPendingLifeLaunch();return;}
 if(outcome==='server-step'){state.step='server';state.authError='';render();return;}
 if(outcome==='close-interaction'){state.selectedInteraction=null;render();return;}
 if(outcome==='contacts'){state.mobileRoster=true;render();return;}
 if(outcome==='root'){// On Home, Android Back is deliberately not an implicit logout or app exit.
   if(state.connected)toast('You are on Tavi Home.');return;
 }
 // Reuse the proven Tavi shell route and preserve session, drafts and chat state.
 state.panel=outcome;state.mobileRoster=outcome==='home';render();
 if(outcome==='app-store'&&!extensionCatalog.length)void loadExtensionStore();
}

async function action(name){
 if(name==='back'){goBackInTavi();return;}
 if(name==='minimize-view'||name==='home'){if(state.panel==='messenger'&&!state.mobileRoster)surfaces.minimizeChat(state.peer,nameOf(state.peer));state.panel='home';state.mobileRoster=true;render();return;}
 if(name==='app-store'){marketplaceSelected='';state.panel='app-store';state.mobileRoster=false;render();if(!extensionCatalog.length||Date.now()-extensionLastCheckedAt>=EXTENSION_CHECK_INTERVAL)void loadExtensionStore();return;}
 if(name==='wallet'){await openCoreWallet();return;}
 if(name==='store-refresh'){void loadExtensionStore({manual:true});return;}
 if(name==='check-extension-updates'){state.panel='app-store';state.mobileRoster=false;render();void loadExtensionStore({manual:true});return;}
 if(name==='main-menu'){state.panel='menu';state.mobileRoster=false;render();return;}
 if(name==='atrium'){const url=reviewedAtriumBase(state.atriumUrl);if(!url)return toast('Atrium is not configured for this server.');await openExternalGame(url);return;}if(name==='developer'){if(!state.developerAllowed||!state.developerVisible)return;state.panel=name;await updateDeveloperInfo();render();return;}
 if(name==='developer-refresh'){await updateDeveloperInfo();render();return;}
 if(name==='companion'){if(extensionEnabled(BUNDLED_COMPANION_ID)){await openInstalledExtension(BUNDLED_COMPANION_ID);return;}state.panel='app-store';state.mobileRoster=false;render();if(!extensionCatalog.length)void loadExtensionStore();return;}
 if(name==='inbox'){state.panel='inbox';state.mobileRoster=false;render();return;}
 if(name==='contacts'){state.panel='messenger';state.mobileRoster=true;render();return;}
 if(name==='check-updates'){await checkForUpdates(true);return;}
 if(name==='download-update'){await openReleaseDownload();return;}
 if(name==='android-update-self-test'){await testAndroidUpdater();return;}
 if(name==='android-update-status'){try{const {invoke}=await import('@tauri-apps/api/core');showUpdateStatus(await invoke('tavi_android_update_status'));}catch{toast('Updater status is not available.');}return;}
 if(name==='android-update-copy-diagnostics'){await copyAndroidUpdaterDiagnostics();return;}
 if(name==='dismiss-update'){if(updateInfo){localStorage.setItem(`tavi.update.dismissed.${updateInfo.version}`,'yes');updateInfo=null;render();}return;}
 if(name==='copy-diagnostics'){showDiagnosticReport();return;}
 if(name==='about'){toast('Tavi '+CLIENT_VERSION+' · powered by Social on LoopRD');return;}
 if(name==='send-bug-report'){
  if(state.reportSending)return;
  const source=document.querySelector('#server-form input[name="server"]')?.value||state.proposedServer||config.server;
  const note=document.getElementById('bug-report-note')?.value||'';
  state.reportSending=true;state.reportStatus='Sending report…';
  try{const response=await sendBugReport({origin:source,version:CLIENT_VERSION,platform:clientPlatform,stage:state.reportStage,code:state.reportCode,note});state.reportStatus='Report received by LoopRD. Reference: '+response.id;}
  catch(e){state.reportStatus='Could not send report: '+e.message;}
  finally{state.reportSending=false;render();}
  return;
 }
 if(name==='format-help'){toast('Plain text messages · Shift+Enter inserts a new line.');return;}
 if(name==='settings'||name==='messenger'||name==='games'||name==='portrait'){if(name!=='settings')state.recoveryCodes=null;if(name==='settings'){state.settingsPage='root';void refreshPushReadiness();}if(name==='messenger'&&nativeDesktop){await openChatWindow(state.peer||'lobby');return;}state.panel=name;state.mobileRoster=false;render();if(name==='games')void refresh({mailboxOnly:true});return;}
 if(name==='refresh'){await loadCatalog();return refresh();}
 if(name==='notifications'){const ok=await grantNotifications();state.pushPermission=await notificationPermissionStatus();toast(ok?'OS alerts enabled while Tavi is running.':'Notification permission not granted.');return;}
 if(name==='push-check'){
   await refreshPushReadiness();
   if(state.pushCapability && state.api){
    try{const list=await state.api.pushDevices();toast(`${(list.devices||[]).length} push device(s) registered. ${backgroundPushState().label}`);}
    catch(e){toast(`Push status: ${e.message}`);}
   }else toast(backgroundPushState().label);
   return;
 }
 if(name==='test-notification'){const ok=await sendTestNotification();state.pushPermission=await notificationPermissionStatus();toast(ok?'Test notification sent to the OS.':'Grant OS notification permission first.');return;}
 if(name==='toggle-mute'){state.mute=!state.mute;render();return;}
 if(name==='remember-device'){if(!state.api)return;const remember=!state.sessionRemembered;try{await sessionStore.save({origin:state.api.origin,token:state.api.token,profileId:state.profile.profileId,remember});state.sessionRemembered=remember;toast(remember?'Sign-in is saved for this Windows account.':'Persistent sign-in disabled.');}catch(e){toast('Could not change saved sign-in: '+e.message);}return;}
 if(name==='retry-session'){if(state.retryAvailable){sessionRetry.disable();void restoreSession();}return;}
 if(name==='switch-account'){sessionRetry.disable();state.retryAvailable=false;state.retryOrigin='';state.serverStatus='Choose a server to sign in with another account. The saved credential is preserved until sign-out or a new successful sign-in.';render();return;}
 if(name==='hide-recovery-codes'){state.recoveryCodes=null;state.recoveryMessage='Codes are no longer visible. Generate new codes if they were not saved.';render();return;}
 if(name==='signout'){state.recoveryCodes=null;const api=state.api;let removalError=null;try{await sessionStore.clear();}catch(e){removalError=e;}stop();state.sessionRemembered=false;try{await api?.logout();}catch{}toast(removalError?'Signed out; protected local session could not be removed: '+removalError.message:'Signed out of this device.');return;}
 if(name==='add-friend'){state.panel='add-friend';state.mobileRoster=false;state.friendError='';render();return;}
 if(name==='accept-friend'){try{await state.api.acceptContact(state.peer);await refresh();}catch(e){toast(e.message);}return;}
 if(name==='remove-friend'){if(!confirm('Remove this contact?'))return;try{await state.api.removeContact(state.peer);state.peer='lobby';await refresh();}catch(e){toast(e.message);}return;}
 if(name==='add-game'){const game=prompt('Game component ID on this LoopRD server:');if(!game)return;try{componentPath(state.api.origin,game,'activity');if(!config.games.includes(game)){if(config.games.length>=20)throw Error('Maximum 20 game components');config.games.push(game);writeConfig(config);}await refresh();}catch(e){toast(e.message);}return;}}
async function openInteractionLink(eventId,actionId){
 const event=state.interactions.find(e=>e.id===eventId&&e.status==='open');
 const selected=event?.actions?.find(a=>a.id===actionId&&a.type==='open-url');
 if(!selected)return toast('This link is no longer available.');
 const {isSafePublishedGameUrl}=await import('./protocol.js');
 if(!isSafePublishedGameUrl(selected.url))return toast('Unsafe URL blocked.');
 // External sites never receive a Social bearer or an implied admin grant.
 // Until LoopRD supports scoped handoff, open links without SSO.
 await openExternalGame(selected.url);
}
function wire(){
 wireExclusiveMenus(document.querySelectorAll('.menubar .menu-drop'));
 document.querySelectorAll('[data-settings-page]').forEach(el=>el.addEventListener('click',()=>{state.settingsPage=el.dataset.settingsPage||'root';state.recoveryCodes=null;render();if(state.settingsPage==='about'&&clientPlatform==='android'&&isTauri())void listenAndroidUpdater();}));
 const settingsSearch=document.getElementById('settings-search');if(settingsSearch)settingsSearch.addEventListener('input',()=>{const term=settingsSearch.value.trim().toLowerCase();document.querySelectorAll('[data-settings-search]').forEach(row=>{row.hidden=!!term&&!row.dataset.settingsSearch.includes(term);});document.querySelectorAll('.tavi-settings-index .md-settings-group').forEach(group=>{const rows=[...group.querySelectorAll('[data-settings-search]')];group.hidden=rows.length>0&&rows.every(row=>row.hidden);});});
 document.querySelectorAll('[data-notify-pref]').forEach(el=>el.addEventListener('change',()=>{const key=el.dataset.notifyPref;if(!['messages','preview','requests'].includes(key))return;state.notifyPrefs[key]=el.checked;saveNotificationPrefs(localStorage,notificationPrefsKey(state.api.origin,state.profile.profileId),state.notifyPrefs);render();}));
 document.querySelectorAll('[data-set-theme]').forEach(el=>el.addEventListener('click',()=>setTheme(el.dataset.setTheme)));
 const pushOptIn=document.getElementById('push-opt-in');if(pushOptIn)pushOptIn.addEventListener('change',()=>{state.pushPrefs.backgroundEnabled=pushOptIn.checked;savePushPreferences(localStorage,pushKey(),state.pushPrefs);render();});
 document.querySelectorAll('[data-inbox-filter]').forEach(el=>el.addEventListener('click',()=>{state.inboxFilter=el.dataset.inboxFilter;state.selectedInteraction=null;render();}));
 document.querySelectorAll('[data-interaction-dismiss]').forEach(el=>el.addEventListener('click',async()=>{if(!state.api)return;const id=Number(el.dataset.interactionDismiss);try{await state.api.dismissInteraction(id);state.selectedInteraction=null;await refresh();toast('Notification dismissed.');}catch(err){state.interactionError=err.message||'Dismiss failed';render();}}));
 document.querySelectorAll('[data-interaction]').forEach(el=>el.addEventListener('click',()=>{state.selectedInteraction=Number(el.dataset.interaction);render();}));
 document.querySelectorAll('[data-interaction-link]').forEach(el=>el.addEventListener('click',()=>openInteractionLink(Number(el.dataset.interactionLink),el.dataset.linkAction)));
 document.querySelectorAll('[data-interaction-reply]').forEach(form=>form.addEventListener('submit',async e=>{e.preventDefault();if(!state.api)return;const id=Number(form.dataset.interactionReply),actionId=form.dataset.replyAction;const values=Object.fromEntries(new FormData(form).entries());try{await state.api.replyInteraction(id,actionId,values);await refresh();toast('Response recorded.');}catch(err){state.interactionError=err.message||'Response failed';render();}}));document.querySelectorAll('[data-group]').forEach(el=>el.addEventListener('click',()=>{const id=el.dataset.group;state.rosterGroups[id]=state.rosterGroups[id]===false;render();}));
 const rosterFilter=document.getElementById('roster-filter');if(rosterFilter)rosterFilter.addEventListener('input',e=>applyContactFilter(e.target.value));
 const messageSearch=document.getElementById('message-search');
 if(messageSearch){messageSearch.addEventListener('input',()=>{state.messageSearch=messageSearch.value;applyInboxFilter(document.getElementById('message-threads'),{query:state.messageSearch,filter:state.messageFilter});});applyInboxFilter(document.getElementById('message-threads'),{query:state.messageSearch,filter:state.messageFilter});}
 document.querySelectorAll('[data-message-filter]').forEach(button=>button.addEventListener('click',()=>{state.messageFilter=button.dataset.messageFilter;document.querySelectorAll('[data-message-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));applyInboxFilter(document.getElementById('message-threads'),{query:state.messageSearch,filter:state.messageFilter});}));
 document.querySelectorAll('[data-resume-surface]').forEach(el=>el.addEventListener('click',()=>void resumeSurface(el.dataset.resumeSurface)));
 document.querySelectorAll('[data-home-game]').forEach(el=>el.addEventListener('click',()=>void launchPromoted(el.dataset.homeGame,true)));
 const storeSearch=document.getElementById('tavi-store-search');
 if(storeSearch)storeSearch.addEventListener('input',()=>{marketplaceQuery=storeSearch.value;marketplaceApplySearch();});
 document.querySelectorAll('[data-marketplace-filter]').forEach(el=>el.addEventListener('click',()=>{marketplaceFilter=el.dataset.marketplaceFilter;marketplaceApplySearch();}));
 marketplaceApplySearch();
 document.querySelectorAll('[data-marketplace-manage]').forEach(el=>el.addEventListener('click',()=>{const panel=document.getElementById('tavi-marketplace-repositories');if(panel){panel.open=true;panel.scrollIntoView({block:'nearest'});}}));
 document.querySelectorAll('[data-marketplace-back]').forEach(el=>el.addEventListener('click',()=>{marketplaceSelected='';render();}));
 document.querySelectorAll('[data-extension-details]').forEach(el=>el.addEventListener('click',()=>{marketplaceSelected=el.dataset.extensionDetails;render();}));
 document.querySelectorAll('[data-extension-switch]').forEach(el=>el.addEventListener('click',()=>{extensionSwitchApproval=el.dataset.extensionSwitch;render();}));
 document.querySelectorAll('[data-extension-switch-cancel]').forEach(el=>el.addEventListener('click',()=>{extensionSwitchApproval=null;render();}));
 document.querySelectorAll('[data-extension-switch-approve]').forEach(el=>el.addEventListener('click',()=>void switchExtensionSource(el.dataset.extensionSwitchApprove)));
 const repositoryForm=document.getElementById('extension-repository-form');if(repositoryForm)repositoryForm.addEventListener('submit',e=>{e.preventDefault();void addExtensionRepository(repositoryForm);});
 document.querySelectorAll('[data-repository-remove]').forEach(el=>el.addEventListener('click',()=>{extensionRepoSubscriptions()?.remove(el.dataset.repositoryRemove);void loadExtensionStore();}));
 document.querySelectorAll('[data-extension-install]').forEach(el=>el.addEventListener('click',()=>void installExtension(el.dataset.extensionInstall)));
 document.querySelectorAll('[data-extension-install-cancel]').forEach(el=>el.addEventListener('click',()=>{extensionInstallApproval=null;render();}));
 document.querySelectorAll('[data-extension-install-approve]').forEach(el=>el.addEventListener('click',()=>void installExtension(el.dataset.extensionInstallApprove)));
 document.querySelectorAll('[data-extension-open]').forEach(el=>el.addEventListener('click',()=>void openInstalledExtension(el.dataset.extensionOpen)));
 document.querySelectorAll('[data-extension-disable]').forEach(el=>el.addEventListener('click',()=>{extensionAccountStore()?.disable(el.dataset.extensionDisable);if(el.dataset.extensionDisable===BUNDLED_COMPANION_ID&&extensionStoreScope)clearCompanionPreview(localStorage,extensionStoreScope);render();}));
 document.querySelectorAll('[data-extension-enable]').forEach(el=>el.addEventListener('click',()=>{const entry=extensionCatalog.find(x=>x.manifest.id===el.dataset.extensionEnable);try{if(entry)extensionAccountStore()?.enable(entry.manifest,extensionSource(entry));render();}catch(e){toast(e.message);}}));
 document.querySelectorAll('[data-extension-remove]').forEach(el=>el.addEventListener('click',()=>{if(!confirm('Remove this extension from this account on this device?'))return;extensionAccountStore()?.uninstall(el.dataset.extensionRemove);if(el.dataset.extensionRemove===BUNDLED_COMPANION_ID&&extensionStoreScope)clearCompanionPreview(localStorage,extensionStoreScope);render();}));
 document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>action(el.dataset.action)));
 wireAppPages(document);
 const reduced=globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||false;
 document.querySelectorAll('.tavi-app-pages,.roster-scroll,.tavi-message-scroll,.aux-content,.tavi-chat-history').forEach(el=>wireElasticScroll(el,{reducedMotion:reduced}));
 document.querySelectorAll('[data-pet-care]').forEach(el=>el.addEventListener('click',()=>{changePet(p=>performCare(p,el.dataset.petCare));}));
 document.querySelectorAll('[data-pet-select]').forEach(el=>el.addEventListener('click',()=>{changePet(p=>selectCompanion(p,el.dataset.petSelect));}));
 document.querySelectorAll('[data-pet-mode]').forEach(el=>el.addEventListener('click',()=>{changePet(p=>changeMode(p,el.dataset.petMode));}));
 document.querySelectorAll('[data-pet-dismiss]').forEach(el=>el.addEventListener('click',()=>{changePet(p=>dismissSuggestion(p,el.dataset.petDismiss));}));
 const enabledEl=document.getElementById('companion-enabled');if(enabledEl)enabledEl.addEventListener('change',()=>changePet(p=>updatePreferences(p,{enabled:enabledEl.checked})));
 const floatingEl=document.getElementById('companion-floating');if(floatingEl)floatingEl.addEventListener('change',()=>changePet(p=>updatePreferences(p,{overlay:floatingEl.checked?'floating':'off'})));
 const inappEl=document.getElementById('companion-inapp');if(inappEl)inappEl.addEventListener('change',()=>changePet(p=>updatePreferences(p,{overlay:inappEl.checked?'in-app':'off'})));
 const modeEl=document.getElementById('companion-mode');if(modeEl)modeEl.addEventListener('change',()=>changePet(p=>changeMode(p,modeEl.value)));
 const nameEl=document.getElementById('companion-name');if(nameEl)nameEl.addEventListener('change',()=>changePet(p=>updatePreferences(p,{name:nameEl.value})));

 document.querySelectorAll('[data-auth]').forEach(el=>el.addEventListener('click',()=>{state.authTab=el.dataset.auth;state.authError='';render();}));
 document.querySelectorAll('[data-settings-section]').forEach(el=>el.addEventListener('toggle',()=>{state.settingsExpanded[el.dataset.settingsSection]=el.open;}));
 document.querySelectorAll('[data-peer]').forEach(el=>el.addEventListener('click',async()=>{const peer=el.dataset.peer;if(nativeDesktop){await openChatWindow(peer);return;}if(state.peer!==peer)state.draft='';state.peer=peer;state.panel='messenger';state.mobileRoster=false;markRead(peer,state.peerFeeds.get(peer)||[]);render();await refresh();}));
 document.querySelectorAll('[data-select-game-room]').forEach(el=>el.addEventListener('click',async()=>{
   state.selectedRoomId=el.dataset.selectGameRoom;state.roomMessages=[];state.roomDraft='';render();
   try{const feed=await state.api.gameRoomFeed(state.selectedRoomId);
     if(feed.roomId===state.selectedRoomId){state.roomMessages=feed.messages||[];state.roomError='';}}
   catch(e){state.roomError=e.message;}render();
 }));
 const roomForm=document.getElementById('game-room-form');if(roomForm){roomForm.elements.text?.addEventListener('input',()=>{state.roomDraft=roomForm.elements.text.value;});roomForm.addEventListener('submit',async e=>{
   e.preventDefault();if(state.busy||!state.api||!state.selectedRoomId)return;
   const id=state.selectedRoomId,text=new FormData(roomForm).get('text');state.busy=true;
   try{await state.api.gameRoomSend(id,text);state.roomDraft='';roomForm.reset();const feed=await state.api.gameRoomFeed(id);
     if(state.selectedRoomId===id){state.roomMessages=feed.messages||[];state.roomError='';}}
   catch(err){state.roomError=err.message||'Could not send to match';}
   finally{state.busy=false;render();}
 });}
 document.querySelectorAll('[data-open-match-window]').forEach(el=>el.addEventListener('click',()=>void openMatchWindow(el.dataset.openMatchWindow)));
 document.querySelectorAll('[data-remove-game]').forEach(el=>el.addEventListener('click',()=>{config.games=config.games.filter(x=>x!==el.dataset.removeGame);writeConfig(config);refresh();}));
 document.querySelectorAll('[data-game-token]').forEach(el=>el.addEventListener('click',()=>{const text=prompt('Game bearer token (blank for public; held in memory only):');if(text!==null){state.gameTokens.set(el.dataset.gameToken,text);refresh();}}));
 document.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>openGame(el.dataset.route)));
 document.querySelectorAll('[data-challenge-game]').forEach(form=>form.addEventListener('submit',async e=>{
   e.preventDefault();if(!state.api||state.busy)return;
   const peer=new FormData(form).get('peer');const gameId=form.dataset.challengeGame;
   if(!peer||!gameId)return;
   state.busy=true;const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
   try{await state.api.challengeContact(peer,gameId);
       toast('Challenge sent. Your contact can accept or decline in Tavi.');}
   catch(err){toast('Challenge failed: '+(err.message||String(err)));}
   finally{state.busy=false;if(submit)submit.disabled=false;}
 }));
 document.querySelectorAll('[data-launch-game]').forEach(el=>el.addEventListener('click',()=>launchPromoted(el.dataset.launchGame,true)));
 document.querySelectorAll('[data-open-promoted]').forEach(el=>el.addEventListener('click',()=>launchPromoted(el.dataset.openPromoted,false)));
 document.querySelectorAll('[data-game]').forEach(el=>el.addEventListener('click',()=>{state.panel='games';render();}));
 const recoveryForm=document.getElementById('recovery-codes-form');if(recoveryForm)recoveryForm.addEventListener('submit',async e=>{e.preventDefault();if(!state.api)return;const password=new FormData(recoveryForm).get('password');try{const data=await state.api.recoveryCodesCreate(password);state.recoveryCodes=data.codes;state.recoveryMessage='';state.settingsExpanded.recovery=true;render();}catch(err){state.recoveryCodes=null;state.recoveryMessage=err.message||'Could not generate recovery codes';render();}});
 const devSwitch=document.getElementById('developer-switch');if(devSwitch)devSwitch.addEventListener('change',async()=>{if(!state.developerAllowed)return;state.developerVisible=devSwitch.checked;state.developerInfo=null;state.developerError='';if(!state.developerVisible&&state.panel==='developer')state.panel='settings';if(state.developerVisible)await updateDeveloperInfo();render();});
 const server=document.getElementById('server-form');if(server)server.addEventListener('submit',async e=>{e.preventDefault();if(connecting||state.restoring)return;sessionRetry.disable();state.retryAvailable=false;connecting=true;const origin=new FormData(server).get('server');state.serverStatus='';try{const capability=await discoverSocial(origin);if(!capability.available){state.step='server';state.serverStatus=capability.reason;}else if(!capability.accounts){state.step='server';state.serverStatus='This Social component requires an upgrade for account registration.';}else{state.step='account';state.serverStatus='Social is available on this server.';state.authTab=capability.registration?'register':'login';state.recoverySupported=capability.recoveryCodes===true;state.proposedServer=new URL(origin).origin;}}catch(err){state.step='server';state.serverStatus=err.message||'Server unavailable.';state.reportStage='discovery';state.reportCode=err?.code==='DISCOVERY_TIMEOUT'?'DISCOVERY_TIMEOUT':err?.code==='DISCOVERY_NETWORK'?'DISCOVERY_NETWORK':'DISCOVERY_FAILED';}finally{connecting=false;render();}});
 const auth=document.getElementById('auth-form');if(auth)auth.addEventListener('submit',async e=>{e.preventDefault();if(connecting||state.restoring)return;sessionRetry.disable();state.retryAvailable=false;connecting=true;const data=new FormData(auth);state.authError='';try{const api=state.authTab==='recover'?await recoverSocial(state.proposedServer,data.get('username'),data.get('recoveryCode'),data.get('password')):await (state.authTab==='register'?registerSocial:loginSocial)(state.proposedServer,data.get('username'),data.get('password'));await activate(api);try{const remember=data.get('remember')==='yes';await sessionStore.save({origin:api.origin,token:api.token,profileId:state.profile.profileId,remember});state.sessionRemembered=remember;toast(remember?'Welcome! This device will remember your sign-in.':'Welcome to Tavi!');}catch(storageError){toast('Signed in, but local session storage failed: '+storageError.message);}}catch(e){state.authError=e.message||'Registration failed';state.reportStage='login';state.reportCode='LOGIN_FAILED';render();}finally{connecting=false;}});
 const friend=document.getElementById('friend-form');if(friend)friend.addEventListener('submit',async e=>{e.preventDefault();const handle=new FormData(friend).get('username');try{await state.api.requestContact(handle);state.friendError='';state.panel='messenger';state.mobileRoster=true;await refresh();toast('Friend request sent to '+handle+'.');}catch(err){state.friendError=err.message||'Could not send friend request';render();}});
 const msg=document.getElementById('message-form');if(msg)msg.addEventListener('submit',async e=>{e.preventDefault();if(state.busy)return;const raw=msg.elements.message.value,value=raw.trim();if(!value)return;const info=composerState(value,messageLimit(state.peer));if(info.over){state.draft=raw;updateComposerFeedback(msg.elements.message,state.peer);toast(info.error);return;}state.busy=true;updateComposerFeedback(msg.elements.message,state.peer);try{if(state.peer==='lobby')await state.api.send(value);else await state.api.directSend(state.peer,value);state.draft='';await refresh();}catch(e){state.draft=raw;toast(e.message);}finally{state.busy=false;}});
 const entry=document.getElementById('message');if(entry){entry.addEventListener('input',()=>{state.draft=entry.value;updateComposerFeedback(entry,state.peer);});entry.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();entry.form?.requestSubmit();}});updateComposerFeedback(entry,state.peer);}
 const profile=document.getElementById('profile-form');if(profile)profile.addEventListener('submit',async e=>{e.preventDefault();try{const result=await state.api.saveProfile({schema:'looprd.social.profile/v1',profileId:state.profile.profileId,displayName:profile.elements.displayName.value,appearance:state.profile.appearance||null,portraitCode:state.profile.portraitCode||null},state.revision);state.profile=result.profile;state.revision=result.revision;toast('Profile saved.');}catch(e){toast(e.message);}});
}
// Native chat windows NEVER receive Social credentials. The main webview is their
// authenticated broker. Client-side identifiers are checked before every request;
// Social still authorizes every private read/write on the server.
let nativeBridgeReady=false;
async function nativeChatSnapshot(peer){
 if(!state.api)throw Error('Please sign in again from the contact list.');
 if(!isValidChatPeer(peer))throw Error('Invalid conversation');
 const contact=peer==='lobby'?null:state.contacts.find(c=>c.id===peer);
 if(peer!=='lobby'&&!contact)throw Error('Contact not available on this account.');
 const pending=peer!=='lobby'&&contact.status!=='accepted';
 const result=pending?{messages:[]}:peer==='lobby'?await state.api.feed():await state.api.directFeed(peer);
 if(peer!=='lobby'&&!pending){state.peerFeeds.set(peer,result.messages||[]);rememberPeerReceipts(peer,result);}
 return {peer,title:peer==='lobby'?'Community Lobby':contact.username,online:!!contact?.online,
   pending:pending?(contact.direction==='incoming'?'incoming':'outgoing'):null,
   messages:(result.messages||[]).slice(-100).map(m=>({id:m.id,authorId:m.authorId,displayName:m.displayName||(m.authorId===state.profile.profileId?state.profile.displayName:contact?.username)||'Friend',text:m.text,at:m.at,receipt:peer==='lobby'?null:messageReceipt(m,state.profile.profileId,peerReceipt(peer))})),
   myId:state.profile.profileId,server:new URL(state.api.origin).host};
}
async function initializeNativeChatBridge(){
 if(!nativeDesktop||nativeBridgeReady)return;
 nativeBridgeReady=true;
 await listen('social-chat-viewed',e=>{const {peer,label,upToId}=e.payload||{};if(!state.api||!isValidChatPeer(peer)||peer==='lobby'||chatWindowLabel(peer)!==label||!state.contacts.some(c=>c.id===peer&&c.status==='accepted'))return;const messages=state.peerFeeds.get(peer)||[];if(!messages.some(m=>m.id===upToId))return;markRead(peer,messages.filter(m=>m.id<=upToId));render();});
 await listen('social-chat-request',async e=>{
   const {label,peer,kind,text,requestId}=e.payload||{};
   if(!/^chat-[a-zA-Z0-9_-]{1,72}$/.test(label||'')||chatWindowLabel(peer)!==label||!Number.isSafeInteger(requestId))return;
   try{
     if(!state.api)throw Error('Disconnected from Social.');
     if(kind==='send'){
       if(typeof text!=='string'||!text.trim())throw Error('Enter a message.');
       const info=composerState(text.trim(),messageLimit(peer));if(info.over)throw Error(info.error);
       if(peer==='lobby')await state.api.send(text.trim());
       else {if(!state.contacts.some(c=>c.id===peer&&c.status==='accepted'))throw Error('Contact request not accepted.');await state.api.directSend(peer,text.trim());}
     } else if(kind==='accept'){
       if(!state.contacts.some(c=>c.id===peer&&c.status==='pending'&&c.direction==='incoming'))throw Error('No incoming request.');
       await state.api.acceptContact(peer);
     } else if(kind!=='snapshot')throw Error('Unknown conversation action.');
     const snapshot=await nativeChatSnapshot(peer);
     await emitTo(label,'social-chat-response',{requestId,ok:true,snapshot});
     if(kind!=='snapshot')void refresh();
   }catch(err){await emitTo(label,'social-chat-response',{requestId,ok:false,error:err.message||'Request failed.'}).catch(()=>{});}
 });
}
let nativeMatchBridgeReady=false;
async function nativeMatchSnapshot(roomId,api){
 if(!api || !state.profile || !state.gameRooms.some(r=>r.roomId===roomId))throw Error('Match is not available to this account.');
 const feed=await api.gameRoomFeed(roomId); // Social verifies current game seat and match consent on each request.
 if(api!==state.api)throw Error('Account changed. Reopen the match conversation.');
 const room=state.gameRooms.find(r=>r.roomId===roomId);
 if(!room || feed.roomId!==roomId)throw Error('Match access was revoked.');
 return {room:{roomId,gameId:room.gameId,matchId:room.matchId,participants:room.participants},
   myId:state.profile.profileId,messages:feed.messages||[]};
}
async function initializeNativeMatchBridge(){
 if(!nativeDesktop||nativeMatchBridgeReady)return;
 nativeMatchBridgeReady=true;
 await listen('social-match-request',async e=>{
  const {roomId,label,requestId,kind,text}=e.payload||{};
  if(!isValidMatchRoom(roomId)||matchWindowLabel(roomId)!==label||
      !Number.isSafeInteger(requestId)||requestId<1)return;
  try{
   const api=state.api;
   if(!api || !state.gameRooms.some(r=>r.roomId===roomId))throw Error('Match access is unavailable.');
   if(kind==='send'){
    if(typeof text!=='string'||!text.trim()||text.length>1000)throw Error('Invalid match message.');
    await api.gameRoomSend(roomId,text.trim());
   }else if(kind!=='snapshot')throw Error('Unsupported match action.');
   const snapshot=await nativeMatchSnapshot(roomId,api);
   await emitTo(label,'social-match-response',{label,roomId,requestId,ok:true,snapshot});
  }catch(error){
   await emitTo(label,'social-match-response',{label,roomId,requestId,ok:false,
     error:error.message||'Match request denied'}).catch(()=>{});
  }
 });
}
async function openMatchWindow(roomId){
 if(!nativeDesktop)return;
 if(!state.api||!isValidMatchRoom(roomId)||!state.gameRooms.some(r=>r.roomId===roomId)){
  toast('Match is not available to this account.');return;
 }
 try{
  await initializeNativeMatchBridge();
  const label=matchWindowLabel(roomId);
  const existing=await WebviewWindow.getByLabel(label);
  if(existing){await existing.show();await existing.setFocus();surfaces.activate('chat:'+peer);return;}
  const room=state.gameRooms.find(r=>r.roomId===roomId);
  const windowHandle=new WebviewWindow(label,{url:`match.html?room=${roomId}`,
    title:`${room.gameId} · Match chat - Tavi`,width:570,height:520,
    minWidth:410,minHeight:365,resizable:true,center:true});
  windowHandle.once('tauri://error',e=>toast('Could not open match conversation: '+String(e.payload)));
 }catch(e){toast('Cannot open match chat: '+e.message);}
}
async function openChatWindow(peer){
 if(!nativeDesktop)return;
 if(!state.api||!isValidChatPeer(peer)){toast('Conversation is not available.');return;}
 if(peer!=='lobby'&&!state.contacts.some(c=>c.id===peer)){toast('Contact not found.');return;}
 try{
   await initializeNativeChatBridge();await initializeSurfaceBridge();
   const label=chatWindowLabel(peer);
   const existing=await WebviewWindow.getByLabel(label);
   if(existing){await existing.show();await existing.setFocus();surfaces.activate('chat:'+peer);return;}
   const title=peer==='lobby'?'Community Lobby':(state.contacts.find(c=>c.id===peer)?.username||'Conversation');
   nativeChildLabels.add(label);
   const windowHandle=new WebviewWindow(label,{url:`chat.html?peer=${encodeURIComponent(peer)}`,title:`${title} - Tavi`,
     width:585,height:525,minWidth:415,minHeight:370,resizable:true,center:true});
   windowHandle.once('tauri://error',e=>toast('Could not open conversation window: '+String(e.payload)));
 }catch(e){toast('Could not open conversation: '+e.message);}
}
window.addEventListener('message',async e=>{if(e.origin!==location.origin||e.source!==document.getElementById('portrait-frame')?.contentWindow||e.data?.type!=='looprd.portrait.selected/v1'||!state.api)return;const code=e.data.code;try{const result=await state.api.saveProfile({schema:'looprd.social.profile/v1',profileId:state.profile.profileId,displayName:state.profile.displayName,appearance:state.profile.appearance||null,portraitCode:code},state.revision);state.profile=result.profile;state.revision=result.revision;state.avatarCode=code;toast('Portrait saved to Social.');}catch(error){toast(error.message);}});
window.addEventListener('focus',()=>{if(state.api){refresh();void refreshGoldBalance(state.api);if(Date.now()-extensionLastCheckedAt>=EXTENSION_CHECK_INTERVAL)void loadExtensionStore();}});
const sessionRetry=createSessionRetry({retry:()=>restoreSession()});
window.addEventListener('online',()=>{if(state.retryAvailable&&!state.api)void sessionRetry.trigger().catch(()=>{});});
window.addEventListener('focus',()=>{if(state.retryAvailable&&!state.api)void sessionRetry.trigger().catch(()=>{});});
async function restoreSession(){
 if(state.api||state.restoring||connecting)return;
 state.restoring=true;
 let saved;
 try {
  const loaded=await sessionStore.load();
  saved=loaded.record;
  state.sessionRemembered=loaded.remembered;
 }catch(error){
  state.serverStatus='Could not read protected sign-in: '+error.message;
  state.restoring=false;render();return;
 }
 if(!saved){sessionRetry.disable();state.retryAvailable=false;state.restoring=false;render();return;}
 state.retryOrigin=saved.origin;
 state.serverStatus='Restoring your Tavi session…';render();
 try{
  const api=new LooprdSocial(saved.origin,saved.token);
  await activate(api); // Server verifies the stored session before any chat is exposed.
  sessionRetry.disable();state.retryAvailable=false;state.retryOrigin='';
 }catch(error){
  const category=classifySessionFailure(error);
  if(category==='rejected'){
   sessionRetry.disable();state.retryAvailable=false;state.retryOrigin='';
   try{await sessionStore.clear();state.sessionRemembered=false;state.serverStatus='Saved sign-in expired or was revoked. Please sign in again.';}
   catch{state.serverStatus='Saved sign-in was rejected, but the local vault could not be cleared. Sign in again and check the device storage.';}
  }else{
   // Never erase a valid device credential because a server is offline, busy,
   // blocked, or returned 403 for a permission/configuration problem.
   state.retryAvailable=true;
   if(category==='temporary'){
    state.serverStatus='Cannot reach Social right now. Your saved sign-in is safe; Tavi will retry automatically.';
    sessionRetry.enable();
   }else{
    state.serverStatus='Social denied access (403). Your saved sign-in is safe; retry after the server permissions are fixed.';
    sessionRetry.disable();
   }
  }
  state.step='server';state.authError='';
 }finally{state.restoring=false;render();}
}
render();void restoreSession();
// Tauri 2.9+ intercepts Android's hardware/gesture Back before its default
// WebView pop/Activity exit. No changes to generated MainActivity files.
if(clientPlatform==='android'){
 void onBackButtonPress(()=>goBackInTavi()).catch(error=>{
  console.warn('Tavi Android system Back handler unavailable:',String(error));
 });
}
// Desktop/web keyboard parity, without interfering with Android's native Back.
if(clientPlatform!=='android')document.addEventListener('keydown',event=>{
 if(event.key!=='Escape'||event.defaultPrevented||event.isComposing)return;
 if(document.querySelector('.menu-drop[open]'))return;
 if(state.connected){event.preventDefault();goBackInTavi();}
});

// Check only while the application is running. GitHub rate limits and offline mode fail silently.
void checkForUpdates();
updatePoll=setInterval(()=>void checkForUpdates(),6*60*60*1000);

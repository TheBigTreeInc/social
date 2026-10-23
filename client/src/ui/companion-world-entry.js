/** Focus the existing publisher-approved world canvas without modifying the asset bytes. */
export function extensionPanelUrl(url,{companion=false}={}){
 if(!companion)return url;
 const parsed=new URL(url);
 if(!parsed.pathname.endsWith('/ui/index.html') || parsed.search || parsed.hash)throw new TypeError('Companion world requires the published entrypoint');
 parsed.hash='viewport';
 return parsed.href;
}

/** Add independent local persistence after the quantity patch and before branding. */
export function storageTemplate(source) {
  let tpl = source;
  const replace = (before, after, label) => {
    const count = tpl.split(before).length - 1;
    if (count !== 1) throw new Error('storage: «' + label + '» найдено ' + count + ' раз');
    tpl = tpl.replace(before, () => after);
  };
  replace('<script src="/design/main-data.js"></script>',
    '<script src="/design/storage.js"></script>\n<script src="/design/main-data.js"></script>', 'runtime');
  replace('const PRESETS=MAIN.presets;', `let DESIGN_OWNER=null,DESIGN_NOTICE=null;
const DESIGN_STORE=window.MagicDesignStorage.createDesignStorage({getStorage:()=>window.localStorage,onError:message=>{if(DESIGN_OWNER)DESIGN_OWNER.toast(message);else DESIGN_NOTICE=message;}});
const DESIGN_SAVED=DESIGN_STORE.load();
if(DESIGN_SAVED){MAIN.presets=DESIGN_SAVED.presets;MAIN.nom=DESIGN_SAVED.nom;MAIN.projects=DESIGN_SAVED.projects;MAIN.estEd=DESIGN_SAVED.estEd;MAIN.blocks=DESIGN_SAVED.blocks;MAIN.roomOpts=DESIGN_SAVED.roomOpts;}
const PRESETS=MAIN.presets;`, 'restore main');
  replace('BLOCKS.forEach(b=>{const l=PRESETS[b.id]||[];',
    'if(DESIGN_SAVED)BLOCKS.splice(0,BLOCKS.length,...DESIGN_SAVED.blocks);\nBLOCKS.forEach(b=>{const l=PRESETS[b.id]||[];', 'restore blocks');
  replace('const optQty=', 'if(DESIGN_SAVED)ROOM_OPTS.splice(0,ROOM_OPTS.length,...DESIGN_SAVED.roomOpts);\nconst optQty=', 'restore options');
  replace("[{n:'Защита стен плёнкой'", "if(!DESIGN_SAVED)[{n:'Защита стен плёнкой'", 'skip saved nomenclature defaults');
  replace('  componentDidMount(){this.applyStart();window.__zamer=this;this.themeTick();}',
    '  componentDidMount(){this.applyStart();window.__zamer=this;this.themeTick();this.startDesignStorage();}', 'mount');
  replace('  componentDidUpdate(pp){if(pp.startScreen!==this.props.startScreen)this.applyStart();if(pp.theme!==this.props.theme&&this.state.themeO)this.setState({themeO:null});this.themeTick();}',
    '  componentDidUpdate(pp){if(pp.startScreen!==this.props.startScreen)this.applyStart();if(pp.theme!==this.props.theme&&this.state.themeO)this.setState({themeO:null});this.themeTick();this.scheduleDesignSave();}', 'update');
  replace('  componentWillUnmount(){if(this._mo)this._mo.disconnect();}',
    '  componentWillUnmount(){this.stopDesignStorage();if(this._mo)this._mo.disconnect();}', 'unmount');
  replace('  seed(){', `  designSnapshot(){return Object.assign({},DESIGN_SAVED||{},{version:1,blocks:BLOCKS,presets:PRESETS,nom:NOM,roomOpts:ROOM_OPTS,projects:this.state.projects,estEd:this.state.estEd});}
  saveDesign(){clearTimeout(this._designSaveTimer);this._designSaveTimer=null;return DESIGN_STORE.save(this.designSnapshot());}
  scheduleDesignSave(){if(!this._designStorageReady)return;clearTimeout(this._designSaveTimer);this._designSaveTimer=setTimeout(()=>this.saveDesign(),120);}
  startDesignStorage(){
    DESIGN_OWNER=this;this._designStorageReady=true;
    this._designPageHide=()=>this.saveDesign();this._designVisibility=()=>{if(document.visibilityState==='hidden')this.saveDesign();};
    window.addEventListener('pagehide',this._designPageHide);document.addEventListener('visibilitychange',this._designVisibility);
    if(DESIGN_NOTICE){const message=DESIGN_NOTICE;DESIGN_NOTICE=null;this.toast(message);}
  }
  stopDesignStorage(){
    this._designStorageReady=false;this.saveDesign();
    window.removeEventListener('pagehide',this._designPageHide);document.removeEventListener('visibilitychange',this._designVisibility);
    if(DESIGN_OWNER===this)DESIGN_OWNER=null;
  }
  seed(){`, 'storage methods');
  return tpl;
}

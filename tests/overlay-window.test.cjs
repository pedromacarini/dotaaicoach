const assert = require('node:assert/strict');
const { test } = require('node:test');

const layout = overrides => ({
  x: null, y: null, scale: 1, opacity: 1, locked: false,
  modules: { stats: true, skill: true, items: true, alerts: true },
  ...overrides,
});

test('layout padrão ancora no canto superior direito da área útil', () => {
  const { resolveOverlayBounds } = require('../dist-electron/electron/overlay-window.js');
  const result = resolveOverlayBounds(layout({}), { x: -1920, y: 0, width: 1920, height: 1040 });
  assert.deepEqual(result, {
    bounds: { x: -452, y: 22, width: 430, height: 314 },
    effectiveScale: 1,
  });
});

test('layout fora da tela é contido e escala respeita a área útil', () => {
  const { resolveOverlayBounds } = require('../dist-electron/electron/overlay-window.js');
  const clamped = resolveOverlayBounds(layout({ x: 9_000, y: -9_000, scale: 1.5 }), { x: 100, y: 50, width: 900, height: 600 });
  assert.deepEqual(clamped.bounds, { x: 355, y: 50, width: 645, height: 471 });
  const tiny = resolveOverlayBounds(layout({ x: 0, y: 0, scale: 1.75 }), { x: 0, y: 0, width: 430, height: 314 });
  assert.equal(tiny.effectiveScale, 1);
  assert.deepEqual(tiny.bounds, { x: 0, y: 0, width: 430, height: 314 });
});

test('área menor que a escala mínima usa fit transitório sem alterar a preferência', () => {
  const { resolveOverlayBounds } = require('../dist-electron/electron/overlay-window.js');
  const result = resolveOverlayBounds(layout({ x: 90, y: 90, scale: .75 }), { x: 10, y: 20, width: 200, height: 150 });
  assert.ok(result.effectiveScale < .75);
  assert.deepEqual(result.bounds, { x: 10, y: 24, width: 200, height: 146 });
});

test('controller emite uma única preferência final após resize com clamp e respeita visibilidade desejada', () => {
  const { EventEmitter } = require('node:events');
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { createPreferencesStore } = require('../dist-electron/electron/preferences.js');
  const { createOverlayWindowController } = require('../dist-electron/electron/overlay-window.js');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dota-window-controller-'));
  class FakeWindow extends EventEmitter {
    constructor() { super(); this.bounds={x:0,y:0,width:430,height:314}; this.visible=false; this.focusable=false; }
    setBounds(value) { this.bounds={...value}; }
    getBounds() { return {...this.bounds}; }
    setOpacity() {} setResizable() {} setFocusable(value){this.focusable=value;} setIgnoreMouseEvents(){}
    show(){this.visible=true;} focus(){} showInactive(){this.visible=true;} hide(){this.visible=false;}
    isDestroyed(){return false;}
  }
  class FakeScreen extends EventEmitter {
    getPrimaryDisplay(){return {workArea:{x:0,y:0,width:800,height:600}};}
    getDisplayMatching(){return this.getPrimaryDisplay();}
  }
  try {
    const store=createPreferencesStore(path.join(folder,'prefs.json'),{debounceMs:1});
    store.updateOverlayLayout({x:9000,y:9000});
    const win=new FakeWindow(); const screen=new FakeScreen(); const emitted=[]; let visible=false;
    const controller=createOverlayWindowController({window:win,screen,store,isVisibleDesired:()=>visible,
      onPreferencesChanged:value=>emitted.push(value),onEditingChanged:()=>{},onEffectiveScaleChanged:()=>{}});
    controller.setEditing(true);
    const result=controller.resize(1.2);
    assert.equal(emitted.length,1);
    assert.deepEqual(emitted[0],result);
    assert.equal(result.overlayLayout.x,284);
    assert.equal(result.overlayLayout.y,223);
    store.updateOverlayLayout({locked:true});
    assert.throws(()=>controller.resize(1.3),/bloqueados/);
    controller.setEditing(false);
    assert.equal(win.visible,false);
    assert.equal(win.focusable,false);
    controller.dispose();
  } finally { fs.rmSync(folder,{recursive:true,force:true}); }
});

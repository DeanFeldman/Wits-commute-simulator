import assert from "node:assert/strict";
import test from "node:test";
import { QuizOverlay } from "../src/levels/crossing/QuizOverlay.js";

test("disposing a Level 2 survey closes and clears it",()=>{
  const classList={remove(){}},button={textContent:"",disabled:false,title:"",addEventListener(){},removeEventListener(){this.removed=true;}};
  const nodes={"#quiz-overlay":{hidden:false,classList},"#quiz-title":{hidden:true},"#quiz-intro":{hidden:true},"#quiz-prompt":{hidden:true},"#quiz-body":{},"#quiz-submit":button,"#quiz-error":{}};
  const previousDocument=globalThis.document;
  globalThis.document={querySelector:(selector)=>nodes[selector],body:{style:{cursor:"default"}},exitPointerLock(){}};
  try{
    const overlay=new QuizOverlay();
    overlay.mode="psychology-questionnaire";
    overlay.questionnaireSession={responses:new Map()};
    overlay.onComplete=()=>{};
    overlay.dispose();
    assert.equal(overlay.root.hidden,true);
    assert.equal(overlay.mode,null);
    assert.equal(overlay.questionnaireSession,null);
    assert.equal(overlay.onComplete,null);
    assert.equal(button.removed,true);
  }finally{globalThis.document=previousDocument;}
});

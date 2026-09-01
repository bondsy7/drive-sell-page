import { describe, it } from "vitest";
import { assessTargetRelativeCandidate } from "../phase2/candidate-scoring";
const NOW="2026-09-01T11:00:00.000Z", FUT="2026-09-02T11:00:00.000Z", C="cluster_a";
const mk=(left:number)=>({schemaVersion:1,assetId:"a",vehicleDetected:true,vehicleClass:"car",identityClusterId:C,sameVehicleConfidence:0.99,
 pose:{canonicalPerspectiveId:"EXT_34_FRONT_LEFT",azimuthDeg:-45},visibility:{front:1,rear:0,leftSide:left,rightSide:0,roof:0.5},
 framing:{fullVehicleVisible:true,cropped:false,visibleWheelPositions:["front_left","rear_left","front_right"]},
 quality:{sharpness:1,occlusion:0,glare:0,resolutionAdequacy:1,usableScore:1},classificationConfidence:0.99,issues:[]});
const asset=(intake:any)=>({id:"a",vehicleMasterId:"vm",requestedPerspectiveId:"EXT_34_FRONT_LEFT",fileName:"f.jpg",previewUrl:"blob:x",createdAtIso:NOW,intake,
 analysis:{fileId:"files/a",providerId:"gemini-file-api",mimeType:"image/jpeg",fileExpiresAtIso:FUT,status:"analyzed",analyzerSchemaVersion:"1",analyzedAtIso:NOW,perspectiveConfidence:0.98},
 scores:{cameraAngle:1,sideAndSurfaceCorrectness:1,requiredSurfaceCoverage:1,quality:1,framing:1},weightedScore:1,hardFailures:[],blockers:[],warnings:[],role:"primary",protection:"unprotected",outputReadyFormats:["4:5"],version:1,history:[{version:1,atIso:NOW,action:"created"}]});
describe("p",()=>{it("x",()=>{
for(const left of [0.45,0.49,0.3,0.1]){
 const a:any=asset(mk(left));
 const r=assessTargetRelativeCandidate({vehicleMaster:{id:"vm",label:"L",vehicleClass:"car",colorFamily:"grey",identityClusterId:C,createdAtIso:NOW,version:1,history:[{version:1,atIso:NOW,action:"created"}],assets:[a]} as any,assetId:"a",targetPerspectiveId:"EXT_34_FRONT_LEFT",intendedRole:"primary",nowIso:NOW});
 console.log(left,JSON.stringify({s:r.scores,w:r.weightedScore,rank:r.rankable,q:r.primaryQualityThresholdMet,m:r.minimumPerspectiveScoreMet,unp:r.unprovenRequiredSurfaces,reasons:r.eligibility.reasons.map(x=>x.code+":"+x.severity)}));
}})});

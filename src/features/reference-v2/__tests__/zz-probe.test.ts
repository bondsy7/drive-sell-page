import { describe, it } from "vitest";
import { assessTargetRelativeCandidate } from "../phase2/candidate-scoring";
import { getPerspectiveSpec } from "../domain/perspectives/registry";
const NOW="2026-09-01T11:00:00.000Z", FUT="2026-09-02T11:00:00.000Z", C="cluster_a";
const mk=(vis:any,q=1)=>({schemaVersion:1,assetId:"a",vehicleDetected:true,vehicleClass:"car",identityClusterId:C,sameVehicleConfidence:0.99,
 pose:{canonicalPerspectiveId:"EXT_34_FRONT_LEFT",azimuthDeg:-45},visibility:vis,
 framing:{fullVehicleVisible:true,cropped:false,visibleWheelPositions:["front_left","rear_left","front_right"]},
 quality:{sharpness:q,occlusion:0,glare:0,resolutionAdequacy:q,usableScore:q},classificationConfidence:0.99,issues:[]});
const asset=(intake:any)=>({id:"a",vehicleMasterId:"vm",requestedPerspectiveId:"EXT_34_FRONT_LEFT",fileName:"f.jpg",previewUrl:"blob:x",createdAtIso:NOW,intake,
 analysis:{fileId:"files/a",providerId:"gemini-file-api",mimeType:"image/jpeg",fileExpiresAtIso:FUT,status:"analyzed",analyzerSchemaVersion:"1",analyzedAtIso:NOW,perspectiveConfidence:0.98},
 scores:{},weightedScore:0,hardFailures:[],blockers:[],warnings:[],role:"primary",protection:"unprotected",outputReadyFormats:[],version:1,history:[{version:1,atIso:NOW,action:"created"}]});
describe("probe",()=>{it("p",()=>{
 const a:any=asset(mk({front:1,rear:0,leftSide:1,rightSide:0,roof:0.5}));
 const r=assessTargetRelativeCandidate({vehicleMaster:{id:"vm",label:"L",vehicleClass:"car",colorFamily:"grey",identityClusterId:C,createdAtIso:NOW,version:1,history:[{version:1,atIso:NOW,action:"created"}],assets:[a]} as any,assetId:"a",targetPerspectiveId:"EXT_34_FRONT_LEFT",intendedRole:"primary",nowIso:NOW});
 console.log(JSON.stringify({s:r.scores,w:r.weightedScore,rank:r.rankable,q:r.primaryQualityThresholdMet,m:r.minimumPerspectiveScoreMet,unp:r.unprovenRequiredSurfaces,wh:r.requiredWheelEvidence,reasons:r.eligibility.reasons},null,1));
 const sp=getPerspectiveSpec("EXT_34_FRONT_LEFT");
 console.log(JSON.stringify({cov:sp.referenceRequirements.requiredCoverageSurfaces,wheels:sp.framing.requiredVisibleWheels}));
})});

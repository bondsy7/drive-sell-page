import { describe, it } from "vitest";
import { ALL_PERSPECTIVE_SPECS } from "../domain/perspectives/registry";
describe("p",()=>{it("x",()=>{
console.log(ALL_PERSPECTIVE_SPECS.filter(s=>!s.applicableVehicleClasses.includes("motorcycle")).map(s=>s.id).join(","));
})});

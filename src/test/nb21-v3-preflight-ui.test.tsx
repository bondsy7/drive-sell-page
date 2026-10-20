import { useState } from 'react';
import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
const {start} = vi.hoisted(()=>({start:vi.fn(()=>true)}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'user'}})}));
vi.mock('@/hooks/useCredits',()=>({useCredits:()=>({balance:999,getCost:()=>3})}));
vi.mock('@/contexts/PipelineContext',()=>({usePipeline:()=>({status:'idle',isRunning:false,isFinished:false,elapsedMs:0,startTime:null,endTime:null,startPipeline:start})}));
vi.mock('@/lib/pipeline-start-guard',()=>({checkPipelineStart:()=>({allowed:true})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({select:()=>({eq:()=>({single:()=>Promise.resolve({data:null})})})})}}));
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PipelineRunner from '@/components/PipelineRunner';
import Nb21V2ReferenceCheck from '@/components/Nb21V2ReferenceCheck';
import { assignV2DetailRoles } from '@/lib/nb21-v2-preflight';
import { checkV3Preflight } from '@/lib/nb21-v3-preflight';
import { Button } from '@/components/ui/button';
import type { RemasterConfig } from '@/lib/remaster-prompt';
afterEach(cleanup);
beforeAll(()=>{ Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true}); Element.prototype.scrollIntoView=vi.fn(); });
const photo=(role:string)=>({sourceId:`detail:${role}`,assetId:`archive/${role}`,sourceRole:role,sourceType:'original' as const,image:'data:image/jpeg;base64,YQ=='});
it('manual right-side assignment unblocks only requested right job; explicit skip removes it',async()=>{
 function Harness(){const [assignments,setAssignments]=useState<Record<string,string>>({});const [jobs,setJobs]=useState([{key:'EXT_34_FRONT_RIGHT',labelDe:'3/4 Front rechts'},{key:'EXT_SIDE_LEFT',labelDe:'Seite links'}]);const sources=assignV2DetailRoles([photo('front'),photo('side'),photo('unassigned-detail')],assignments);const results=checkV3Preflight(jobs,sources);return <><Nb21V2ReferenceCheck version="nb21-v3" sources={sources} results={results} onAssign={(id,role)=>setAssignments({...assignments,[id]:role})} onSkip={key=>setJobs(jobs.filter(j=>j.key!==key))}/><Button disabled={!jobs.length || results.some(r=>!r.ready)} onClick={()=>start(jobs)}>Start</Button></>;}
 render(<Harness/>);expect(screen.getByRole('button',{name:'Start'})).toBeDisabled();
 fireEvent.keyDown(screen.getByRole('combobox',{name:'Detailbild 3 zuordnen'}),{key:'ArrowDown'});
 fireEvent.keyDown(await screen.findByRole('option',{name:'Seite rechts',exact:true}),{key:'Enter'});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Start'})).toBeEnabled());
});
it('actual PipelineRunner explicitly selects V3 and passes one run lighting profile through start',async()=>{
 start.mockClear();
 render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><PipelineRunner modelTier="nb21" inputImages={[]} originalImages={[]} evidenceSources={['front','rear','side','side-right','interior-front','interior-rear','steering','screen','cargo','wheel','headlight','frontpanel','taillight'].map(photo)} vehicleDescription="Volvo" remasterConfig={{scene:'showroom-1',licensePlate:'remove',changeColor:false,showManufacturerLogo:false,showDealerLogo:false} as RemasterConfig} onComplete={vi.fn()} onBack={vi.fn()}/></QueryClientProvider></MemoryRouter>);
 fireEvent.keyDown(screen.getByRole('combobox',{name:'Nano Banana 2.1 Promptversion'}),{key:'ArrowDown'});
 fireEvent.keyDown(await screen.findByRole('option',{name:'NB 2.1 · V3 (Test)'}),{key:'Enter'});
 // Start stays blocked on role-incomplete jobs: skip each explicitly, never guess.
 for(const b of screen.queryAllByRole('button',{name:/überspringen$/})) fireEvent.click(b);
 const buttons=screen.getAllByRole('button');const launch=buttons.find(b=>/Pipeline starten/.test(b.textContent??''));
 expect(launch).toBeDefined(); if(!launch) return;
 fireEvent.click(launch);
 const confirm=await screen.findByRole('button',{name:/Bestätigen|Generierung starten|Jetzt starten|Kostenpflichtig|Starten/i});
 fireEvent.click(confirm);
 await waitFor(()=>expect(start).toHaveBeenCalled());
 const cfg=start.mock.calls[0]?.[0];expect(cfg.promptVersion).toBe('nb21-v3');expect(cfg.lightingProfile.version).toBe('nb21-v3-lighting-1');expect(cfg.lightingProfile.hash).toHaveLength(64);
});

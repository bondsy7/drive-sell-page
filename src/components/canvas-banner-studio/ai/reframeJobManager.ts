// Module-level reframe job manager.
// Survives component unmounts so navigating away from the studio
// does NOT cancel in-flight reframe work.
//
// - Runs per-format reframes in parallel (bounded concurrency).
// - Buffers results so a remounted BildStep can pick them up.
// - Reports progress through callbacks captured at job start time
//   (typically BackgroundTasksContext.updateTask, which lives at App
//   root and stays valid across navigation).

import { reframeImageForFormat } from "./reframeClient";

export interface ReframeFormatTarget {
  formatId: string;
  width: number;
  height: number;
  label?: string;
}

export interface ReframeResult {
  formatId: string;
  imageDataUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
  resolution: string;
}

export interface ReframeJobProgress {
  jobId: string;
  done: number;
  failed: number;
  total: number;
  current?: string;
  finished: boolean;
}

interface JobInternal {
  id: string;
  source: string;
  formats: ReframeFormatTarget[];
  results: ReframeResult[];
  pendingForListener: ReframeResult[];
  errors: { formatId: string; error: string }[];
  done: number;
  failed: number;
  finished: boolean;
  resultListeners: Set<(r: ReframeResult) => void>;
  progressListeners: Set<(p: ReframeJobProgress) => void>;
}

const jobs = new Map<string, JobInternal>();

const CONCURRENCY = 3;

function emitProgress(job: JobInternal, current?: string) {
  const snap: ReframeJobProgress = {
    jobId: job.id,
    done: job.done,
    failed: job.failed,
    total: job.formats.length,
    current,
    finished: job.finished,
  };
  job.progressListeners.forEach((fn) => {
    try { fn(snap); } catch (e) { console.warn("progress listener error", e); }
  });
}

async function runJob(job: JobInternal) {
  let cursor = 0;
  const workers: Promise<void>[] = [];
  const launch = async () => {
    while (cursor < job.formats.length) {
      const idx = cursor++;
      const f = job.formats[idx];
      try {
        const out = await reframeImageForFormat(job.source, f.width, f.height);
        const result: ReframeResult = {
          formatId: f.formatId,
          imageDataUrl: out.imageDataUrl,
          sourceUrl: job.source,
          width: out.width,
          height: out.height,
          resolution: out.resolution,
        };
        job.results.push(result);
        job.done++;
        if (job.resultListeners.size === 0) {
          job.pendingForListener.push(result);
        } else {
          job.resultListeners.forEach((fn) => {
            try { fn(result); } catch (e) { console.warn("result listener error", e); }
          });
        }
        emitProgress(job, f.label ?? f.formatId);
      } catch (e: any) {
        job.failed++;
        job.errors.push({ formatId: f.formatId, error: e?.message ?? String(e) });
        emitProgress(job, f.label ?? f.formatId);
      }
    }
  };
  for (let i = 0; i < Math.min(CONCURRENCY, job.formats.length); i++) {
    workers.push(launch());
  }
  await Promise.all(workers);
  job.finished = true;
  emitProgress(job);
}

export interface StartJobOptions {
  source: string;
  formats: ReframeFormatTarget[];
  onProgress?: (p: ReframeJobProgress) => void;
}

export function startReframeJob(opts: StartJobOptions): string {
  const id = `reframe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const job: JobInternal = {
    id,
    source: opts.source,
    formats: opts.formats,
    results: [],
    pendingForListener: [],
    errors: [],
    done: 0,
    failed: 0,
    finished: false,
    resultListeners: new Set(),
    progressListeners: new Set(),
  };
  if (opts.onProgress) job.progressListeners.add(opts.onProgress);
  jobs.set(id, job);
  emitProgress(job);
  // fire & forget – job continues even if caller unmounts
  runJob(job).catch((e) => console.error("reframe job crashed", e));
  return id;
}

export function subscribeJob(
  jobId: string,
  handlers: {
    onResult?: (r: ReframeResult) => void;
    onProgress?: (p: ReframeJobProgress) => void;
  },
): () => void {
  const job = jobs.get(jobId);
  if (!job) return () => {};
  if (handlers.onProgress) {
    job.progressListeners.add(handlers.onProgress);
    // emit current snapshot immediately
    handlers.onProgress({
      jobId: job.id,
      done: job.done,
      failed: job.failed,
      total: job.formats.length,
      finished: job.finished,
    });
  }
  if (handlers.onResult) {
    // flush pending
    const pending = job.pendingForListener;
    job.pendingForListener = [];
    pending.forEach((r) => handlers.onResult!(r));
    job.resultListeners.add(handlers.onResult);
  }
  return () => {
    if (handlers.onProgress) job.progressListeners.delete(handlers.onProgress);
    if (handlers.onResult) job.resultListeners.delete(handlers.onResult);
  };
}

export function getActiveJobs(): { jobId: string; finished: boolean; done: number; total: number }[] {
  return Array.from(jobs.values()).map((j) => ({
    jobId: j.id, finished: j.finished, done: j.done, total: j.formats.length,
  }));
}

export function disposeJob(jobId: string) {
  jobs.delete(jobId);
}

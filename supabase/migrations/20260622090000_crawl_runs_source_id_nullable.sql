-- The institution-based AI crawler (crawl-worker / process-guideline) tracks runs
-- by institution_id, not the legacy announcement_sources.source_id. source_id was
-- NOT NULL, which made every institution-based crawl_runs insert fail before the
-- run row was created (manifesting as "Edge Function returned a non-2xx status
-- code"). Make it nullable; legacy source-based inserts always supply it, so
-- existing behavior is unchanged.
ALTER TABLE crawl_runs ALTER COLUMN source_id DROP NOT NULL;

-- Conditional-GET validators for the crawl page cache (ETag / Last-Modified),
-- used by crawl-worker to skip unchanged pages cheaply.
ALTER TABLE crawl_page_cache ADD COLUMN IF NOT EXISTS etag text;
ALTER TABLE crawl_page_cache ADD COLUMN IF NOT EXISTS last_modified text;

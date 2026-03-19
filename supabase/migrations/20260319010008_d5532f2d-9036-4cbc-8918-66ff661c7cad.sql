
ALTER TABLE public.brain_dumps DROP CONSTRAINT brain_dumps_task_id_fkey;
ALTER TABLE public.brain_dumps ADD CONSTRAINT brain_dumps_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.triage_queue DROP CONSTRAINT triage_queue_task_id_fkey;
ALTER TABLE public.triage_queue ADD CONSTRAINT triage_queue_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE public.plan_items DROP CONSTRAINT plan_items_task_id_fkey;
ALTER TABLE public.plan_items ADD CONSTRAINT plan_items_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

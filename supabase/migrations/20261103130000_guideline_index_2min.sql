-- PDF navbatini tezlashtirish (2026-11-03, Asrbek: "tezlashtir"): guideline-index
-- har 10 daqiqa o'rniga har 2 daqiqada. Har chaqiruv baribir bitta PDF oladi
-- (CPU limiti), shuning uchun yuk bir xil, faqat tezroq. Job nomi o'zgarmaydi.
select cron.alter_job(jobid, schedule := '*/2 * * * *')
  from cron.job where jobname = 'guideline-index-10min';

// camera-gate va Supabase camera-session bitta kalit formatini ishlatadi: ikki nusxa bir xil bo'lsin.
import { assert } from "./testutil.ts";

Deno.test("kalit moduli: gate va Supabase nusxasi bir xil", async () => {
  const here = new URL(".", import.meta.url);
  const gate = await Deno.readTextFile(new URL("./token.ts", here));
  const edge = await Deno.readTextFile(new URL("../../../supabase/functions/_shared/camera-token.ts", here));
  assert(
    gate === edge,
    "deploy/camera/gate/token.ts va supabase/functions/_shared/camera-token.ts farq qiladi — birini ikkinchisiga nusxalang",
  );
});

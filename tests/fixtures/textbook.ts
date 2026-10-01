/** A textbook page (history, Dutch) with bold and italic terms, for testing the photo-to-terms import. */
export const TEXTBOOK_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #fbfaf6; }
  .page { width: 1100px; padding: 70px 80px; font: 27px/1.55 Georgia, "Times New Roman", serif; color: #1d1d1d; }
  h1 { font: bold 46px/1.2 Georgia, serif; margin: 0 0 30px; }
  p { margin: 0 0 26px; }
  .box { margin-top: 10px; padding: 24px 28px; background: #eef3f8; }
</style></head><body><div class="page">
  <h1>Nederland in de oorlog</h1>
  <p>Op 10 mei 1940 viel Duitsland Nederland binnen. De Duitsers gebruikten de <b>Blitzkrieg</b>, een snelle aanval met tanks en vliegtuigen tegelijk. Na het bombardement op Rotterdam gaf Nederland zich op 15 mei over.</p>
  <p>Tijdens de bezetting werkten sommige Nederlanders samen met de Duitsers. Zij kregen er vaak geld of macht voor terug. Dat noemen we <i>collaboratie</i>. Anderen kozen voor het <b>verzet</b> en hielpen onderduikers, vervalsten persoonsbewijzen en pleegden soms aanslagen.</p>
  <p>In februari 1941 legden duizenden mensen in Amsterdam het werk neer uit protest tegen de jodenvervolging. Deze <b>Februaristaking</b> was de eerste grote openlijke actie tegen de bezetter in Europa.</p>
  <div class="box"><p><b>Onderduiken:</b> je verbergen voor de bezetter, bijvoorbeeld om niet in Duitsland te hoeven werken.</p>
  <p style="margin:0"><b>Hongerwinter:</b> de winter van 1944 op 1945, toen er in het westen van Nederland bijna geen eten meer was.</p></div>
</div></body></html>`;

export const TEXTBOOK_TERMS = ["Blitzkrieg", "collaboratie", "verzet", "Februaristaking", "Onderduiken", "Hongerwinter"];

/** A second page: economics, a sans-serif font, smaller type, multi-word terms (one broken over two lines). */
export const ECONOMICS_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #fff; }
  .page { width: 900px; padding: 50px 60px; font: 22px/1.5 Arial, Helvetica, sans-serif; color: #222; }
  h1 { font: bold 34px/1.2 Arial, sans-serif; margin: 0 0 22px; color: #0b4a8b; }
  p { margin: 0 0 18px; }
</style></head><body><div class="page">
  <h1>2.1 Keuzes maken</h1>
  <p>Mensen hebben veel wensen, maar hun geld en tijd zijn beperkt. Die spanning tussen wensen en middelen heet <b>schaarste</b>. Omdat alles schaars is, moet je steeds kiezen.</p>
  <p>Als je kiest, geef je altijd iets anders op. De waarde van het beste alternatief dat je laat schieten, noemen economen de <b>opportunity costs</b>. Wie een avond gaat werken in de catering, kan die avond niet trainen met het hockeyteam en betaalt dus ook een prijs.</p>
  <p>Een bedrijf dat meer produceert, kan de vaste kosten over meer producten verdelen. Zo ontstaan <i>schaalvoordelen</i>: de kosten per product dalen als de productie stijgt.</p>
  <p>Bij <i>marktwerking</i> bepalen vraag en aanbod samen de prijs, zonder dat de overheid ingrijpt.</p>
</div></body></html>`;

export const ECONOMICS_TERMS = ["schaarste", "opportunity costs", "schaalvoordelen", "marktwerking"];

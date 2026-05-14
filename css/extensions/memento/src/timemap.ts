import { DataFactory, Writer } from "n3";
import type { MementoRecord } from "./types";

const { namedNode, literal, quad } = DataFactory;

const MEMENTO = "http://mementoweb.org/ns#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const XSD = "http://www.w3.org/2001/XMLSchema#";
const DCT = "http://purl.org/dc/terms/";

const aType = namedNode(`${RDF}type`);
const aTimeMap = namedNode(`${MEMENTO}TimeMap`);
const aMemento = namedNode(`${MEMENTO}Memento`);
const aOriginalResource = namedNode(`${MEMENTO}OriginalResource`);
const pOriginal = namedNode(`${MEMENTO}original`);
const pMementoDatetime = namedNode(`${MEMENTO}mementoDatetime`);
const pTimemap = namedNode(`${MEMENTO}timemap`);
const pTimegate = namedNode(`${MEMENTO}timegate`);
const pFrom = namedNode(`${MEMENTO}from`);
const pUntil = namedNode(`${MEMENTO}until`);
const pIsVersionOf = namedNode(`${DCT}isVersionOf`);
const xsdDateTime = namedNode(`${XSD}dateTime`);

export function serializeTimemap(
  originalUri: string,
  records: MementoRecord[],
  toMementoUri: (record: MementoRecord) => string,
): Promise<string> {
  const writer = new Writer({ prefixes: { memento: MEMENTO, dct: DCT, xsd: XSD } });

  const original = namedNode(originalUri);
  const timemapUri = `${originalUri}${originalUri.includes("?") ? "&" : "?"}ext=timemap`;
  const timemap = namedNode(timemapUri);

  writer.addQuad(quad(timemap, aType, aTimeMap));
  writer.addQuad(quad(original, aType, aOriginalResource));
  writer.addQuad(quad(original, pTimemap, timemap));
  writer.addQuad(quad(original, pTimegate, original));

  if (records.length > 0) {
    const datetimes = records.map((r) => r.datetime.getTime());
    const from = new Date(Math.min(...datetimes));
    const until = new Date(Math.max(...datetimes));
    writer.addQuad(quad(timemap, pFrom, literal(from.toISOString(), xsdDateTime)));
    writer.addQuad(quad(timemap, pUntil, literal(until.toISOString(), xsdDateTime)));
  }

  for (const r of records) {
    const m = namedNode(toMementoUri(r));
    writer.addQuad(quad(m, aType, aMemento));
    writer.addQuad(quad(m, pOriginal, original));
    writer.addQuad(quad(m, pIsVersionOf, original));
    writer.addQuad(quad(m, pMementoDatetime, literal(r.datetime.toISOString(), xsdDateTime)));
  }

  return new Promise<string>((resolve, reject) => {
    writer.end((err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

export const UF = { AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins' };

let names;
export function countryName(code) {
  if (!code) return 'País não informado';
  try { names ??= new Intl.DisplayNames(['pt-BR'], { type: 'region' }); return names.of(code) || code; } catch { return code; }
}

export const isBrazil = e => e.countryCode === 'BR';

export function placeLabel(e) {
  const parts = [];
  if (e.city) parts.push(e.city);
  if (e.state) parts.push(e.state);
  if (e.countryCode && e.countryCode !== 'BR') parts.push(countryName(e.countryCode));
  if (!parts.length && e.location) parts.push(e.location);
  if (!parts.length) return e.online ? 'Online' : 'Local não informado';
  return parts.join(', ');
}

const TOPICS = { accessibility: 'Acessibilidade', android: 'Android', api: 'APIs', clojure: 'Clojure', cpp: 'C++', css: 'CSS', data: 'Dados & IA', devops: 'DevOps', dotnet: '.NET', general: 'Geral', graphql: 'GraphQL', groovy: 'Groovy', haskell: 'Haskell', ios: 'iOS', iot: 'IoT', java: 'Java', javascript: 'JavaScript', kotlin: 'Kotlin', leadership: 'Liderança', networking: 'Redes', opensource: 'Open source', performance: 'Performance', php: 'PHP', product: 'Produto', python: 'Python', rust: 'Rust', security: 'Segurança', sre: 'SRE', 'tech-comm': 'Comunicação técnica', testing: 'Testes', typescript: 'TypeScript', ux: 'UX' };
export const topicLabel = t => TOPICS[t] || t;

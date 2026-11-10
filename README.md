# Controle de Alimentos — Igreja Cristã Presbiteriana Missionária

Site para registrar todo mês os alimentos arrecadados (Santa Ceia), comprados e distribuídos,
com relatórios (mês, trimestre, semestre e ano de dezembro a novembro), exportação em PDF e Excel
e arte pronta para o PowerPoint da assembleia.

- **Site:** HTML, CSS e JavaScript (`index.html`), publicado pelo GitHub Pages.
- **Dados:** ficam numa **Planilha Google**, nas abas `Produtos`, `Meses`, `Itens` e `Cesta`.
- **Servidor:** Google Apps Script (`google-apps-script/Code.gs`), preso à planilha.
  É ele que confere a senha; a senha nunca fica no código nem neste repositório.

Nenhum dado da igreja fica no GitHub. O repositório guarda só o código.

## Como colocar no ar

### 1. Planilha Google e servidor
1. Crie uma planilha nova em https://sheets.new e dê um nome (ex.: "Alimentos da igreja").
2. Menu **Extensões > Apps Script**.
3. Apague o que estiver no editor e cole todo o conteúdo de `google-apps-script/Code.gs`. Salve.
4. **Implantar > Nova implantação > tipo "App da Web"**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
5. Autorize quando o Google pedir e copie o **URL do app da Web** (termina em `/exec`).

"Qualquer pessoa" é necessário para o site conseguir falar com o servidor; quem não tiver a senha
não lê nem grava nada.

### 2. Site no GitHub
1. Abra `config.js` e cole o endereço copiado em `apiUrl`.
2. No repositório: **Settings > Pages > Deploy from a branch > main / (root)**.
3. Em alguns minutos o site abre em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

### 3. Primeiro acesso
1. Abra o site. Como ainda não há senha, ele pede para **definir a senha** (ex.: a senha combinada pela igreja).
   Faça isso logo depois de publicar.
2. Vá em **Ajustes > Recuperar de uma cópia** e escolha o arquivo `copia-para-importar.json`
   (entregue separado, fora do repositório) para trazer os produtos, a cesta padrão e os lançamentos
   de 2024 e de janeiro e fevereiro de 2025. Leva um ou dois minutos.

## Uso do dia a dia
- **Lançamento:** escolha ano, mês e unidade (Sede ou Congregação) e digite os quilos.
  A saída já vem preenchida com arrecadação + compra.
- **Relatórios:** escolha o período e baixe o PDF, o Excel ou a arte.
- **Ajustes:** cópia de segurança e troca de senha.
- A planilha pode ser aberta para consulta, mas **edite os dados pelo site**: ele reescreve as abas a cada gravação.

## Segurança
- Senha conferida no servidor, guardada só como código embaralhado nas propriedades do script.
- Cinco senhas erradas seguidas bloqueiam novas tentativas por 60 segundos.
- A sessão vale 12 horas; trocar a senha encerra as sessões abertas.
- O repositório é público (exigência do GitHub Pages gratuito): não coloque nele cópias de segurança nem a senha.

## Arquivos
| Arquivo | Para que serve |
|---|---|
| `index.html` | O site inteiro (com a logo embutida) |
| `config.js` | Endereço do servidor da planilha |
| `backend-google.js` | Conversa entre o site e o servidor |
| `google-apps-script/Code.gs` | Servidor: senha e leitura/gravação na planilha |

Depois de mudar `Code.gs`, publique de novo em **Implantar > Gerenciar implantações > Editar > Nova versão**
(o endereço continua o mesmo).

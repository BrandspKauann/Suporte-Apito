# Apito de Mestre

Gestão de projetos e chamados em português, baseada no Vikunja Community 2.8.0.

Esta cópia é independente: sem histórico Git anterior, usuários, tarefas, banco de dados,
credenciais ou conexão operacional com a instalação Hirayama. Os arquivos de fixtures
em `pkg/db/fixtures` são dados sintéticos dos testes, não são importados na instalação.

As novas colunas são **Novas tarefas**, **Em andamento** e **Concluídas**.
A interface inicia em português brasileiro. O nome da empresa vem preenchido como
Apito de Mestre nas telas de acesso e cadastro.

## Primeiro acesso

Use um banco PostgreSQL vazio e exclusivo desta instalação. Gere um segredo de sessão
próprio e um código de proteção novo. Defina o SHA-256 desse código em
`APITO_SIGNUP_CODE_SHA256`; nunca publique o código nem valores secretos no GitHub.
Não há código de proteção herdado ou senha padrão nesta versão.

O primeiro cadastro no banco vazio será a conta administradora (ID 1). Preencha
empresa **Apito de Mestre**, usuário, e-mail, senha e seu código de proteção. Cadastros
posteriores com o mesmo nome de empresa entram no mesmo espaço com edição, sem
administrar a empresa. Não reutilize banco de dados de outra instalação.

## Publicação na Vercel

1. Crie seu novo repositório GitHub e envie esta pasta. O `origin` aponta para `https://github.com/BrandspKauann/Suporte-Apito.git`.
2. Importe o repositório na Vercel, raiz `./`, Node 24.x. Preserve `vercel.json`:
   ele publica frontend e API em container como dois serviços no mesmo domínio.
3. Conecte PostgreSQL e um bucket S3 privado exclusivos da Apito.
4. Preencha as variáveis do modelo `deploy/vercel-api/.env.example` na Vercel.
   Substitua todos os exemplos: banco, segredo, URL pública, bucket e código.
5. Publique e valide `/api/v2/info`, cadastro, login, projetos, tarefas e anexos no domínio final.

O servidor exige banco, S3, segredo de sessão e hash do código configurados.
Se faltarem, a API encerra a inicialização com mensagem explicativa nos logs.
Não use as configurações da antiga publicação para esta instalação.

## Desenvolvimento e validação

- Frontend: Node 24, `cd frontend`, `pnpm install --frozen-lockfile`, `pnpm dev`.
- API: Go 1.27 com CGO, `go install github.com/magefile/mage@v1.15.0`, `mage build`.
- Testes HTTP da API: `mage test:web`.
- Testes da proteção do cadastro e isolamento: `mage test:hirayama` (nome técnico legado).
- Configuração Vercel: `node --test deploy/vercel-api/config.test.mjs`.
- A porta da API local e o proxy do frontend devem apontar para a mesma instalação.

Enquanto o novo repositório ainda não tiver seu primeiro commit, defina
`RELEASE_VERSION=2.8.0-apito.0` ao usar Mage e `GOFLAGS=-buildvcs=false` ao compilar
localmente. A configuração Docker ignora a pasta `.git` e não depende desse histórico.

Veja `VALIDACAO.md` para os testes efetivamente executados nesta entrega e seus limites.

## Licença

AGPL-3.0-or-later. Preserve `LICENSE` e os avisos dos autores originais.
Ao publicar uma versão modificada, disponibilize o código-fonte correspondente
no novo repositório. Atualize a página Informações legais com a URL real desse repositório.

## API local ativa

Nesta máquina, a API responde em http://localhost:3468/api/v2/info. O container
Apito possui reinício automático e volume próprio, sem banco da Hirayama. A configuração
privada e o código de proteção local estão no arquivo .env ignorado pelo Git.
Esse endereço é local; não é uma publicação na internet.


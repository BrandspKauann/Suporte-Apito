# Validação da Apito de Mestre

Verificação local realizada em 20/11/2026, America/Sao_Paulo.

## Resultado confirmado

- API Go compilada em container com CGO habilitado.
- Instalação iniciada em banco SQLite vazio: 26 requisições HTTP passaram.
- Instalação iniciada em PostgreSQL 17 vazio e exclusivo: outras 26 requisições passaram.
- Código de proteção incorreto recusado antes do cadastro.
- Primeiro cadastro criou a conta administradora e o projeto Apito de Mestre.
- Login com empresa correta aceito; empresa incorreta recusada.
- Projetos e tarefas inicialmente vazios; nenhuma importação de dados da Hirayama.
- Colunas persistidas em português: Novas tarefas, Em andamento e Concluídas.
- Criação, edição e leitura de tarefa, comentário, responsável e etiqueta verificadas.
- Movimento para Concluídas marcou a tarefa como concluída, conferido por nova leitura.
- Acesso sem autenticação recusado.
- Segundo cadastro na Apito compartilhou o projeto com edição; administração da empresa recusada.
- Exclusão da tarefa de teste aceita.
- 129 testes selecionados da interface passaram: cadastro/autopreenchimento, redefinição
  de senha e proteção de dados nos registros de erro.
- Quatro testes da configuração Vercel passaram, incluindo rejeição de configurações
  incompletas e preservação de senhas de banco com caracteres escapados.
- Compilação de produção da interface passou.
- Revisão estática da interface: zero erros e 14 avisos existentes no código de base.
- Configuração Docker Compose validada sem iniciar uma publicação.

## Limites

Os testes HTTP usaram bancos descartáveis e contas sintéticas, removidos ao final.
Não há conta de teste ou senha incluída na entrega.

O repositório de destino é https://github.com/BrandspKauann/Suporte-Apito. Não publiquei na Vercel. O domínio final ainda
não foi definido. Banco, bucket S3, SMTP e segredos de produção precisam ser próprios
da Apito. Envio real de e-mails, anexos em S3 e comportamento da implantação final
dependem desses serviços e não foram confirmados com credenciais de produção.

A criação da cópia não altera nem corrige a publicação antiga em
`centralsuporte.vercel.app`. Os testes descritos acima se referem a esta cópia local.

Não há registro remoto na empresa Hirayama para este pedido da Apito. O diário
local registra a preparação e as verificações enquanto não houver um destino
operacional próprio da Apito autorizado.

## Encerramento das verificações

Interrompi a suíte ampliada mage test:web para priorizar somente a entrega essencial conforme solicitado. Não declaro essa suíte aprovada. O lint Go não executou porque golangci-lint não está instalado; a formatação Go foi conferida. Os 52 testes HTTP reais, 129 testes selecionados de interface e quatro testes de configuração descritos acima passaram.

Mantive a API local ativa em http://localhost:3468/api/v2/info, com HTTP 200, volume próprio e reinício automático.


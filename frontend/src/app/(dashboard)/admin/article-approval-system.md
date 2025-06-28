# Sistema de Aprovação de Artigos - Documentação

## Visão Geral

Implementamos um sistema completo de aprovação onde artigos publicados por autores precisam ser aprovados pelo admin antes de ficarem públicos.

## Mudanças Implementadas

### 1. Base de Dados (Migration: `15_article_approval_system.sql`)

#### Novos Status de Artigo
- **`pending_approval`**: Artigo submetido para aprovação pelo admin
- Mantidos: `draft`, `published`, `archived`, `scheduled`

#### Novas Colunas na Tabela `articles`
- `approved_by`: ID do admin que aprovou o artigo
- `approved_at`: Timestamp da aprovação
- `rejection_reason`: Motivo da rejeição (opcional)
- `submitted_for_approval_at`: Timestamp da submissão para aprovação

#### Novas Funções SQL
- `submit_article_for_approval(uuid)`: Submete artigo para aprovação
- `approve_article(uuid)`: Aprova artigo (admin only)
- `reject_article(uuid, text)`: Rejeita artigo com motivo opcional (admin only)
- `get_pending_articles()`: Lista artigos pendentes de aprovação (admin only)

#### Políticas RLS Atualizadas
- Artigos com status `pending_approval` são visíveis apenas para o autor e admins
- Mantida segurança para outros status

### 2. Frontend - Sistema de Aprovação

#### ArticlesService (`frontend/src/lib/supabase/articles.ts`)
**Novos Métodos:**
```typescript
async submitArticleForApproval(articleId: string)
async getPendingArticles()
async approveArticle(articleId: string)
async rejectArticle(articleId: string, reason?: string)
```

**Tipos Atualizados:**
- `CreateArticleData.status` agora inclui `'pending_approval'`

#### Editor de Artigos (`frontend/src/app/(dashboard)/articles/editor/page.tsx`)
**Mudanças no Comportamento:**
- Botão "Publish" agora mostra "Submit for Approval"
- Quando autor publica, status vai para `pending_approval` ao invés de `published`
- Mensagens atualizadas para informar sobre o processo de aprovação

**Fluxo Atualizado:**
1. Autor cria artigo como `draft`
2. Quando publica, vai para `pending_approval`
3. Admin aprova/rejeita através do painel admin
4. Se aprovado: `published` + `visibility: public`
5. Se rejeitado: volta para `draft` com motivo da rejeição

### 3. Painel de Admin

#### AdminApi (`frontend/src/lib/api/admin.ts`)
**Novos Métodos:**
```typescript
async getPendingArticles(): Promise<ApiResponse<any[]>>
async approveArticle(articleId: string): Promise<ApiResponse<any>>
async rejectArticle(articleId: string, reason?: string): Promise<ApiResponse<any>>
```

#### Novo Componente: ArticleApprovalPanel
**Localização:** `frontend/src/components/admin/ArticleApprovalPanel.tsx`

**Funcionalidades:**
- Lista todos os artigos pendentes de aprovação
- Preview completo do artigo antes da decisão
- Botões para aprovar/rejeitar com confirmação
- Campo opcional para motivo da rejeição
- Atualização automática a cada 30 segundos
- Interface responsiva e intuitiva

#### Página Principal do Admin (`frontend/src/app/(dashboard)/admin/page.tsx`)
- Integração do `ArticleApprovalPanel` como seção principal
- Exibido prominentemente após as estatísticas principais

#### Painel de Moderação Atualizado
**Arquivo:** `frontend/src/components/admin/ArticleModerationPanel.tsx`
- Badge laranja para status `pending_approval`
- Filtro atualizado para incluir "Pending Approval"
- Suporte completo ao novo status

## Fluxo do Usuário

### Para Autores:
1. **Criar Artigo**: Salvar como draft normalmente
2. **Publicar**: Clicar em "Submit for Approval" 
3. **Aguardar**: Artigo fica com status "Pending Approval"
4. **Resultado**: 
   - Se aprovado: Artigo fica público automaticamente
   - Se rejeitado: Volta para draft com feedback do admin

### Para Admins:
1. **Visualizar**: Painel principal mostra artigos pendentes
2. **Revisar**: Preview completo do artigo
3. **Decidir**: Aprovar (publica) ou Rejeitar (volta para draft)
4. **Feedback**: Opcional fornecer motivo da rejeição

## Segurança

### Permissões
- **Aprovação/Rejeição**: Apenas admins globais (`is_global_admin()`)
- **Visualização**: Artigos pendentes visíveis apenas para autor e admins
- **RLS**: Políticas atualizadas para novo status

### Auditoria
- Registra quem aprovou (`approved_by`)
- Timestamp de aprovação (`approved_at`)
- Motivo de rejeição preservado (`rejection_reason`)

## Interface do Usuário

### Indicadores Visuais
- **Badge Laranja**: "Pending Approval" para status claro
- **Ícones Intuitivos**: Clock para pendente, Check para aprovar, X para rejeitar
- **Mensagens Contextuais**: Toasts informam sobre resultado das ações

### Responsividade
- Layout adaptável para desktop e mobile
- Dialogs otimizados para diferentes tamanhos de tela
- Tabelas responsivas com scroll horizontal se necessário

## Performance

### Otimizações
- **React Query**: Cache de dados com invalidação inteligente
- **Polling**: Atualização automática a cada 30 segundos
- **Lazy Loading**: Componentes carregados sob demanda
- **Indexes**: Novos índices para queries de aprovação

### Métricas
- Queries otimizadas para status `pending_approval`
- Bulk operations para ações em lote
- Debounced search para filtros

## Compatibilidade

### Backward Compatibility
- **APIs Existentes**: Totalmente compatíveis
- **Dados Existentes**: Artigos atuais não afetados
- **UI Existente**: Funcionalidades anteriores preservadas

### Migração
- Migration segura com rollback disponível
- Dados existentes mantêm status atual
- Sem downtime na aplicação

## Monitoramento

### Métricas Sugeridas
- Tempo médio de aprovação
- Taxa de aprovação vs rejeição
- Volume de artigos pendentes
- Atividade de admins no sistema

### Logs
- Todas as ações de aprovação/rejeição são auditadas
- Timestamps completos para rastreabilidade
- Motivos de rejeição preservados para análise

## Status da Implementação

✅ **Base de Dados**: Migration completa com novas funções SQL  
✅ **Backend**: APIs de aprovação funcionais  
✅ **Frontend Editor**: Processo de submissão implementado  
✅ **Admin Panel**: Interface completa de aprovação  
✅ **Segurança**: RLS e permissões adequadas  
✅ **UI/UX**: Interfaces responsivas e intuitivas  
✅ **Documentação**: Guia completo disponível  

## Próximos Passos

### Melhorias Futuras
1. **Notificações**: Email/push para autores quando artigo é aprovado/rejeitado
2. **Analytics**: Dashboard de métricas de aprovação
3. **Workflow**: Múltiplos níveis de aprovação
4. **Templates**: Motivos padrão de rejeição
5. **Scheduling**: Aprovação com agendamento de publicação

### Monitoramento
1. Acompanhar tempo de resposta das APIs
2. Monitorar volume de artigos pendentes
3. Coletar feedback dos usuários sobre o processo
4. Otimizar baseado em padrões de uso 
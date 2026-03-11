import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type {
  SalesConversation, SalesMessage, SalesTask,
  SalesKnowledgeDocument, SalesAssistantProfile,
  CustomerJourneyTemplate, GenerateRequest, GenerateResponse,
} from '@/types/sales-assistant';

export function useSalesAssistant() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<SalesAssistantProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [conversations, setConversations] = useState<SalesConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [tasks, setTasks] = useState<SalesTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [documents, setDocuments] = useState<SalesKnowledgeDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [journeyTemplates, setJourneyTemplates] = useState<CustomerJourneyTemplate[]>([]);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastResponse, setLastResponse] = useState<GenerateResponse | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);
    const { data } = await supabase.from('sales_assistant_profiles' as any).select('*').eq('user_id', user.id).single();
    setProfile(data as any);
    setProfileLoading(false);
  }, [user]);

  const saveProfile = useCallback(async (updates: Partial<SalesAssistantProfile>) => {
    if (!user) return;
    const { data: existing } = await supabase.from('sales_assistant_profiles' as any).select('id').eq('user_id', user.id).single();
    if (existing) {
      await supabase.from('sales_assistant_profiles' as any).update({ ...updates, updated_at: new Date().toISOString() } as any).eq('user_id', user.id);
    } else {
      await supabase.from('sales_assistant_profiles' as any).insert({ ...updates, user_id: user.id } as any);
    }
    await loadProfile();
  }, [user, loadProfile]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setConversationsLoading(true);
    const { data } = await supabase.from('sales_assistant_conversations' as any).select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
    setConversations((data as any) || []);
    setConversationsLoading(false);
  }, [user]);

  const loadMessages = useCallback(async (conversationId: string): Promise<SalesMessage[]> => {
    const { data } = await supabase.from('sales_assistant_messages' as any).select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    return (data as any) || [];
  }, []);

  const loadTasks = useCallback(async (conversationId?: string) => {
    if (!user) return;
    setTasksLoading(true);
    let query = supabase.from('sales_assistant_tasks' as any).select('*').eq('user_id', user.id);
    if (conversationId) query = query.eq('conversation_id', conversationId);
    const { data } = await query.order('created_at', { ascending: false });
    setTasks((data as any) || []);
    setTasksLoading(false);
  }, [user]);

  const updateTaskStatus = useCallback(async (taskId: string, status: string) => {
    await supabase.from('sales_assistant_tasks' as any).update({ status, updated_at: new Date().toISOString() } as any).eq('id', taskId);
    await loadTasks();
  }, [loadTasks]);

  const loadDocuments = useCallback(async () => {
    if (!user) return;
    setDocumentsLoading(true);
    const { data } = await supabase.from('sales_knowledge_documents' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setDocuments((data as any) || []);
    setDocumentsLoading(false);
  }, [user]);

  const uploadDocument = useCallback(async (file: File, title: string, documentType: string, versionLabel?: string) => {
    if (!user) return;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/misc/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('sales-knowledge').upload(path, file);
    if (uploadError) throw uploadError;
    const { data: doc } = await supabase.from('sales_knowledge_documents' as any).insert({
      user_id: user.id, title, document_type: documentType, source_type: 'upload',
      storage_path: path, mime_type: file.type, embedding_status: 'pending',
      version_label: versionLabel || null,
    } as any).select().single();
    if (doc) {
      supabase.functions.invoke('ingest-sales-knowledge', { body: { documentId: (doc as any).id } }).catch(console.error);
    }
    await loadDocuments();
  }, [user, loadDocuments]);

  const toggleDocumentActive = useCallback(async (docId: string, isActive: boolean) => {
    await supabase.from('sales_knowledge_documents' as any).update({ is_active: isActive, updated_at: new Date().toISOString() } as any).eq('id', docId);
    await loadDocuments();
  }, [loadDocuments]);

  const deleteDocument = useCallback(async (docId: string, storagePath?: string) => {
    if (storagePath) await supabase.storage.from('sales-knowledge').remove([storagePath]);
    await supabase.from('sales_knowledge_documents' as any).delete().eq('id', docId);
    await loadDocuments();
  }, [loadDocuments]);

  const loadJourneyTemplates = useCallback(async () => {
    if (!user) return;
    setJourneyLoading(true);
    const { data } = await supabase.from('customer_journey_templates' as any).select('*')
      .or(`user_id.eq.${user.id},is_global.eq.true`).order('sort_order', { ascending: true });
    setJourneyTemplates((data as any) || []);
    setJourneyLoading(false);
  }, [user]);

  const saveJourneyTemplate = useCallback(async (template: Partial<CustomerJourneyTemplate>) => {
    if (!user) return;
    if (template.id) {
      await supabase.from('customer_journey_templates' as any).update({ ...template, updated_at: new Date().toISOString() } as any).eq('id', template.id);
    } else {
      await supabase.from('customer_journey_templates' as any).insert({ ...template, user_id: user.id } as any);
    }
    await loadJourneyTemplates();
  }, [user, loadJourneyTemplates]);

  const deleteJourneyTemplate = useCallback(async (templateId: string) => {
    await supabase.from('customer_journey_templates' as any).delete().eq('id', templateId);
    await loadJourneyTemplates();
  }, [loadJourneyTemplates]);

  const generateResponse = useCallback(async (request: GenerateRequest): Promise<GenerateResponse | null> => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-sales-response', { body: request });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastResponse(data);
      return data;
    } finally {
      setGenerating(false);
    }
  }, []);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await supabase.from('sales_assistant_conversations' as any).delete().eq('id', conversationId);
    await loadConversations();
  }, [loadConversations]);

  const loadProjects = useCallback(async () => {
    if (!user) return [];
    const { data } = await supabase.from('projects').select('id, title, vehicle_data').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    return data || [];
  }, [user]);

  const loadLeads = useCallback(async () => {
    if (!user) return [];
    const { data } = await supabase.from('leads').select('*').eq('dealer_user_id', user.id).order('created_at', { ascending: false }).limit(50);
    return data || [];
  }, [user]);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadConversations();
      loadTasks();
      loadDocuments();
      loadJourneyTemplates();
    }
  }, [user]);

  return {
    profile, profileLoading, saveProfile, loadProfile,
    conversations, conversationsLoading, loadConversations, deleteConversation,
    loadMessages,
    tasks, tasksLoading, loadTasks, updateTaskStatus,
    documents, documentsLoading, loadDocuments, uploadDocument, toggleDocumentActive, deleteDocument,
    journeyTemplates, journeyLoading, loadJourneyTemplates, saveJourneyTemplate, deleteJourneyTemplate,
    generating, lastResponse, generateResponse,
    loadProjects, loadLeads,
  };
}

import { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type PlaceholderDefinition = {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'select' | 'textarea' | 'color' | 'checkbox' | 'image';
  options: Array<{ value: string; label: string }>;
  default_value: string | null;
  required: boolean;
  placeholder_text: string | null;
  description: string | null;
  parent_id: string | null;
  trigger_value: string | null;
  condition: { field?: string; value?: any } | null;
};

type AssignedPlaceholder = {
  id: string;
  display_order: number;
  overrides: { label?: string; default_value?: string; required?: boolean } | null;
  placeholder_definition: PlaceholderDefinition;
};

interface PlaceholderRendererProps {
  presetId: string;
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onImageUpload?: (key: string, file: File) => void;
}

export default function PlaceholderRenderer({
  presetId,
  values,
  onChange,
  onImageUpload,
}: PlaceholderRendererProps) {
  const [placeholders, setPlaceholders] = useState<AssignedPlaceholder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlaceholders();
  }, [presetId]);

  const loadPlaceholders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("preset_placeholders")
        .select(`
          id,
          display_order,
          overrides,
          placeholder_definition:placeholder_definitions(
            id, key, label, type, options, default_value,
            required, placeholder_text, description,
            parent_id, trigger_value, condition
          )
        `)
        .eq("preset_id", presetId)
        .order("display_order");

      if (error) throw error;

      const formatted = (data || []).map((item: any) => ({
        id: item.id,
        display_order: item.display_order,
        overrides: item.overrides,
        placeholder_definition: item.placeholder_definition,
      })) as AssignedPlaceholder[];

      setPlaceholders(formatted);

      // Initialize defaults
      formatted.forEach((ph) => {
        const def = ph.placeholder_definition;
        if (values[def.key] === undefined) {
          const defaultVal = ph.overrides?.default_value || def.default_value;
          if (defaultVal) onChange(def.key, defaultVal);
          else if (def.type === 'checkbox') onChange(def.key, false);
        }
      });
    } catch (err) {
      console.error("Error loading placeholders:", err);
    } finally {
      setLoading(false);
    }
  };

  const placeholderById = useMemo(() => {
    const map: Record<string, PlaceholderDefinition> = {};
    placeholders.forEach(p => { map[p.placeholder_definition.id] = p.placeholder_definition; });
    return map;
  }, [placeholders]);

  const shouldShowField = (ph: AssignedPlaceholder): boolean => {
    const def = ph.placeholder_definition;
    if (def.parent_id && def.trigger_value) {
      const parent = placeholderById[def.parent_id];
      if (parent) {
        const parentValue = values[parent.key];
        const normalized = typeof parentValue === 'boolean' ? String(parentValue) : parentValue;
        return normalized === def.trigger_value;
      }
      return false;
    }
    if (def.condition?.field) {
      return def.condition.value !== undefined
        ? values[def.condition.field] === def.condition.value
        : !!values[def.condition.field];
    }
    return true;
  };

  const getLabel = (ph: AssignedPlaceholder) => ph.overrides?.label || ph.placeholder_definition.label;
  const getRequired = (ph: AssignedPlaceholder) => ph.overrides?.required ?? ph.placeholder_definition.required;

  const getDepth = (def: PlaceholderDefinition): number => {
    let depth = 0, current = def;
    while (current.parent_id && placeholderById[current.parent_id]) {
      depth++; current = placeholderById[current.parent_id];
    }
    return depth;
  };

  const renderField = (ph: AssignedPlaceholder) => {
    const def = ph.placeholder_definition;
    const key = def.key;
    const label = getLabel(ph);
    const required = getRequired(ph);
    const value = values[key];
    const depth = getDepth(def);
    const indent = depth > 0 ? 'ml-4 pl-4 border-l-2 border-accent/20' : '';

    switch (def.type) {
      case 'text':
        return (
          <div key={key} className={`space-y-1.5 ${indent}`}>
            <Label htmlFor={key} className="text-sm">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
            {def.description && <p className="text-xs text-muted-foreground">{def.description}</p>}
            <Input id={key} value={value || ""} onChange={(e) => onChange(key, e.target.value)} placeholder={def.placeholder_text || label} />
          </div>
        );
      case 'textarea':
        return (
          <div key={key} className={`space-y-1.5 ${indent}`}>
            <Label htmlFor={key} className="text-sm">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
            {def.description && <p className="text-xs text-muted-foreground">{def.description}</p>}
            <Textarea id={key} value={value || ""} onChange={(e) => onChange(key, e.target.value)} placeholder={def.placeholder_text || label} rows={3} />
          </div>
        );
      case 'select':
        return (
          <div key={key} className={`space-y-1.5 ${indent}`}>
            <Label htmlFor={key} className="text-sm">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
            {def.description && <p className="text-xs text-muted-foreground">{def.description}</p>}
            <Select value={value || ""} onValueChange={(v) => onChange(key, v)}>
              <SelectTrigger><SelectValue placeholder={def.placeholder_text || `${label} wählen...`} /></SelectTrigger>
              <SelectContent>
                {(def.options || []).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'color':
        return (
          <div key={key} className={`space-y-1.5 ${indent}`}>
            <Label htmlFor={key} className="text-sm">{label}</Label>
            <div className="flex items-center gap-2">
              <Input type="color" value={value || "#000000"} onChange={(e) => onChange(key, e.target.value)} className="w-16 h-9 p-1" />
              <Input type="text" value={value || "#000000"} onChange={(e) => onChange(key, e.target.value)} className="flex-1" />
            </div>
          </div>
        );
      case 'checkbox':
        return (
          <div key={key} className={`flex items-start space-x-2 ${indent}`}>
            <Checkbox id={key} checked={value || false} onCheckedChange={(checked) => onChange(key, checked)} className="mt-0.5" />
            <div>
              <Label htmlFor={key} className="text-sm cursor-pointer">{label}</Label>
              {def.description && <p className="text-xs text-muted-foreground">{def.description}</p>}
            </div>
          </div>
        );
      case 'image':
        return (
          <div key={key} className={`space-y-1.5 ${indent}`}>
            <Label htmlFor={key} className="text-sm">{label}</Label>
            {def.description && <p className="text-xs text-muted-foreground">{def.description}</p>}
            <Input id={key} type="file" accept="image/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onImageUpload) onImageUpload(key, file);
            }} />
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) return <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Felder laden...</div>;

  const sorted = [...placeholders].sort((a, b) => {
    const ad = getDepth(a.placeholder_definition), bd = getDepth(b.placeholder_definition);
    return ad !== bd ? ad - bd : a.display_order - b.display_order;
  });

  const visible = sorted.filter(shouldShowField);
  if (visible.length === 0) return null;

  return <div className="space-y-4">{visible.map(renderField)}</div>;
}

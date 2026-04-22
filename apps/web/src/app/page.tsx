import { getTasks } from "@/lib/tasks";
import { ItemsClient } from "./items-client";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Rocket,
  BrainCircuit,
  Cpu,
  BarChart3,
  ArrowRight,
  Sparkles,
  Zap,
  LayoutGrid
} from "lucide-react";

export default function Home() {
  const tasks = getTasks();

  const highPriority = tasks.filter(t => t.priority === "high" || t.priority === "critical").length;
  const categories = Array.from(new Set(tasks.map(t => t.category))).length;
  const activeTasks = tasks.filter(t => t.status === "active").length;

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      {/* Welcome Header */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles size={20} />
          <span className="text-xs font-bold uppercase tracking-widest">Dashboard de Control</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white mt-1">
          Bienvenido, <span className="text-primary">Emilio</span>
        </h1>
        <p className="text-neutral-500 max-w-xl">
          Gestiona tus motores de arbitraje y configuraciones de inteligencia artificial desde un solo lugar.
        </p>
      </header>

      {/* Quick Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Rocket size={24} />}
          label="Motores Totales"
          value={tasks.length}
          trend="+2 este mes"
        />
        <StatCard
          icon={<BarChart3 size={24} />}
          label="Prioridad Alta"
          value={highPriority}
          color="text-amber-500"
        />
        <StatCard
          icon={<Cpu size={24} />}
          label="Categorías"
          value={categories}
        />
        <StatCard
          icon={<Zap size={24} />}
          label="Activos"
          value={activeTasks}
          color="text-emerald-500"
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        {/* AI Configuration Section */}
        <section className="lg:col-span-12 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <BrainCircuit size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Configuración de IA</h2>
                <p className="text-sm text-neutral-500 font-medium">Define los modelos de lenguaje para tus automatizaciones.</p>
              </div>
            </div>
          </div>

          <Card variant="outline" className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">G</div>
                  <h3 className="font-bold">Google Gemini</h3>
                </div>
                <div className="space-y-4">
                  <p className="text-xs text-neutral-500">Selecciona el motor de Google para tareas de razonamiento avanzado y grandes contextos.</p>
                  <select className="w-full h-11 bg-secondary border border-white/5 rounded-xl px-4 text-sm text-white outline-none focus:border-primary transition-colors">
                    <option>Gemini 1.5 Pro</option>
                    <option>Gemini 1.5 Flash</option>
                    <option>Gemini 1.0 Ultra</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-tighter">Status: Latencia Optimizada</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-xs italic">H</div>
                  <h3 className="font-bold">Hugging Face (Open Source)</h3>
                </div>
                <div className="space-y-4">
                  <p className="text-xs text-neutral-500">Utiliza modelos abiertos de HuggingFace Hub para tareas específicas y mayor privacidad.</p>
                  <select className="w-full h-11 bg-secondary border border-white/5 rounded-xl px-4 text-sm text-white outline-none focus:border-primary transition-colors">
                    <option>Llama 3 (8B Instruct)</option>
                    <option>Mistral v0.2</option>
                    <option>Phi-3 Mini</option>
                    <option>Gemma 7B</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-tighter">Status: Conectado a Hub API</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-white/5 flex justify-end">
              <Button variant="primary">
                Guardar Configuración
              </Button>
            </div>
          </Card>
        </section>

        {/* Recent Activity / Quick Access */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Actividad de Motores</h2>
            <Link href="/tareas" className="text-xs font-bold text-primary hover:underline flex items-center gap-1 group">
              Ver todas <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="space-y-3">
            {tasks.slice(0, 3).map((task) => (
              <Card key={task.id} variant="outline" className="p-5 hover:bg-white/[0.02] transition-colors border-white/5 cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <LayoutGrid size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{task.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="neutral" className="text-[9px]">{task.category}</Badge>
                      <span className="text-[10px] text-neutral-600 font-bold uppercase tracking-tighter">ID: {task.id}</span>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <Badge variant={task.priority === 'critical' ? 'error' : (task.priority === 'high' ? 'warning' : 'neutral')}>
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="lg:col-span-4 flex flex-col gap-6">
          <h2 className="text-xl font-bold tracking-tight">Gestor de Datos</h2>
          <Card variant="glass" className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
              <BarChart3 size={32} />
            </div>
            <div>
              <h4 className="font-bold mb-1">Items API</h4>
              <p className="text-xs text-neutral-500 px-4">Accede al gestor de items en tiempo real vía Fastify + MongoDB.</p>
            </div>
            <Link href="/items-manager" className="w-full">
              <Button variant="secondary" className="w-full shadow-lg shadow-primary/20">
                Abrir Items
              </Button>
            </Link>
          </Card>
        </section>
      </div>

      <ItemsClient />
    </div>
  );
}

function StatCard({ icon, label, value, trend, color = "text-white" }: {
  icon: React.ReactNode,
  label: string,
  value: number | string,
  trend?: string,
  color?: string
}) {
  return (
    <Card variant="outline" className="p-6 space-y-4 hover:border-primary/20 transition-colors border-white/5">
      <div className="p-2 rounded-xl bg-secondary w-fit text-neutral-400 group-hover:text-primary transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest">{label}</p>
        <div className="flex items-end gap-2 mt-1">
          <p className={`text-4xl font-bold tracking-tight ${color}`}>{value}</p>
          {trend && <span className="text-[10px] font-bold text-emerald-500 mb-1">{trend}</span>}
        </div>
      </div>
    </Card>
  );
}


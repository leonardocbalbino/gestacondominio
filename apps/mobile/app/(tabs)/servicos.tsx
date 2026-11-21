import { Link, type Href } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, T, Titulo } from '@/components/ui';

const ITENS: { titulo: string; detalhe: string; href?: Href }[] = [
  { titulo: 'Ceder minha vaga', detalhe: 'Empréstimo ou aluguel para outra unidade', href: '/ceder-vaga' },
  { titulo: 'Cadastrar locatário', detalhe: 'Temporada (Airbnb, Booking) ou aluguel', href: '/locatario' },
  { titulo: 'Reservar espaço', detalhe: 'Salão de festas, churrasqueira', href: '/reservar' },
  { titulo: 'Encomendas', detalhe: 'Avisos da portaria', href: '/encomendas' },
  { titulo: 'Ocorrências', detalhe: 'Registrar um problema', href: '/ocorrencias' },
  { titulo: 'Assembleias', detalhe: 'Pautas e votação por unidade', href: '/assembleias' },
];

export default function TelaServicos() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="gap-3.5 px-[18px] py-5">
        <Titulo className="text-[24px]">Serviços</Titulo>
        <Card className="overflow-hidden">
          {ITENS.map((it, i) => {
            const conteudo = (
              <Pressable accessibilityRole={it.href ? 'link' : 'text'} className={`min-h-11 px-4 py-3 ${i ? 'border-t border-surface-2' : ''}`}>
                <View>
                  <T className="font-inter-semibold">{it.titulo}</T>
                  <T className="text-[12px] text-muted">{it.href ? it.detalhe : `${it.detalhe} · em breve`}</T>
                </View>
              </Pressable>
            );
            return it.href ? (
              <Link key={it.titulo} href={it.href} asChild>
                {conteudo}
              </Link>
            ) : (
              <View key={it.titulo}>{conteudo}</View>
            );
          })}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

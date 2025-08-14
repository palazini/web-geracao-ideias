import { useEffect, useState } from "react";
import {
  Title, Card, Text, Group, SimpleGrid, Table, Badge, Loader, ScrollArea
} from "@mantine/core";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer } from "recharts";

const STATUS_COLORS = {
  nova: "gray",
  em_avaliacao: "yellow",
  aprovada: "blue",
  em_execucao: "violet",
  concluida: "green",
  reprovada: "red",
};

export default function Dashboard() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadIdeas() {
      const snap = await getDocs(collection(db, "ideas"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setIdeas(list);
      setLoading(false);
    }
    loadIdeas();
  }, []);

  if (loading) {
    return <Group justify="center" mt="xl"><Loader /></Group>;
  }

  // Contagem por status
  const statusCount = ideas.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  // Top por score
  const topIdeas = [...ideas]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10);

  // Dados para gráfico por área
  const areaCount = ideas.reduce((acc, i) => {
    acc[i.area] = (acc[i.area] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.entries(areaCount).map(([name, value]) => ({ name, value }));
  const COLORS = ["#4dabf7", "#82c91e", "#fcc419", "#ff6b6b", "#845ef7"];

  return (
    <>
      <Title order={2} mb="md">Dashboard</Title>

      {/* Cards de resumo */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        {Object.keys(statusCount).map((status) => (
          <Card key={status} withBorder radius="md" p="lg">
            <Group justify="space-between">
              <Text fw={500}>{status.replace("_", " ")}</Text>
              <Badge color={STATUS_COLORS[status] || "gray"}>
                {statusCount[status]}
              </Badge>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      {/* Tabela Top 10 */}
      <Title order={4} mb="sm">Top 10 ideias por score</Title>
      <ScrollArea>
        <Table striped highlightOnHover withBorder>
          <thead>
            <tr>
              <th>Título</th>
              <th>Área</th>
              <th>Status</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {topIdeas.map((idea) => (
              <tr key={idea.id}>
                <td>{idea.title}</td>
                <td>{idea.area}</td>
                <td>
                  <Badge color={STATUS_COLORS[idea.status] || "gray"}>
                    {idea.status}
                  </Badge>
                </td>
                <td>{idea.score || 0}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ScrollArea>

      {/* Gráfico por área */}
      <Title order={4} mt="lg" mb="sm">Distribuição por área</Title>
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
              label
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <ReTooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

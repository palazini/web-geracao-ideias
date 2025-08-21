import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card, Title, Text, Group, Button, SimpleGrid,
  Select, Loader, Badge, Stack, TextInput, Switch, Divider,
} from "@mantine/core";
import {
  collection, getDocs, onSnapshot, orderBy, query,
  where, limit, startAfter, doc, getDoc
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link } from "react-router-dom";

import IdeaCard from "../components/IdeaCard";
import { norm } from '../lib/search';

const PAGE_SIZE = 12;
const GROUP_FIRST = 3;   // quantos itens exibir inicialmente por status
const GROUP_PAGE  = 30;  // tamanho do "carregar mais" por status
const SEARCH_AUTOLOAD_LIMIT = 50;

const AREAS = ["Segurança","Qualidade","Produtividade","Custo","Ergonomia"];

const STATUS = [
  { value: "nova",          label: "Nova" },
  { value: "em_avaliacao",  label: "Em avaliação" },
  { value: "aprovada",      label: "Aprovada" },
  { value: "em_execucao",   label: "Em execução" },
  { value: "concluida",     label: "Concluída" },
  { value: "reprovada",     label: "Reprovada" },
];
const STATUS_ORDER = ["nova","em_avaliacao","aprovada","em_execucao","concluida","reprovada"];
const statusLabel = (s) => STATUS.find(x => x.value === s)?.label ?? s;

const uniqById = (arr) => {
  const seen = new Set();
  const out = [];
  for (const it of arr) {
    if (!it || !it.id) continue;
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
};

function normalizeText(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
function matches(item, term) {
  if (!term) return true;
  const hay = normalizeText(`${item.title || ""} ${item.description || ""}`);
  return hay.includes(term);
}

export default function IdeasList() {
  const ideasCol = useMemo(() => collection(db, "ideas"), []);
  const [status, setStatus] = useState(null);
  const [area, setArea] = useState(null);
  const [managerId, setManagerId] = useState(null);

  const [committeeUsers, setCommitteeUsers] = useState([]);

  const [loading, setLoading] = useState(true);

  // Modo “lista plana”
  const [ideas, setIdeas] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [qText, setQText] = useState("");
  const termNorm = normalizeText(qText);
  const searchPrefix = termNorm.length >= 3 ? termNorm.slice(0, Math.min(6, termNorm.length)) : null;
  const isSearchActive = termNorm.length >= 2;

  const [groupByStatus, setGroupByStatus] = useState(true);

  const ideasRef = useRef(ideas);
  useEffect(() => { ideasRef.current = ideas; }, [ideas]);

  const [rewards, setRewards] = useState({});

  // carregar membros do comitê para filtro de gestão
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const list = snap.docs
          .map(d => ({ id: d.id, ...(d.data() || {}) }))
          .filter(u => u.role === "comite")
          .map(u => ({
            id: u.id,
            name: u.displayName || u.username || u.email || u.id,
            email: u.email || "",
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) setCommitteeUsers(list);
      } catch (e) {
        console.warn("[IdeasList] carregar comitê:", e?.code || e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ===========================================================
   *  SINGLE QUERY (lista plana)
   * =========================================================== */
  const useSingleQuery =
    !groupByStatus || isSearchActive || !!status;

  const baseQuery = useMemo(() => {
    if (!useSingleQuery) return null;
    const clauses = [];
    if (status) clauses.push(where("status", "==", status));
    if (area) clauses.push(where("area", "==", area));
    if (managerId) clauses.push(where("managerId", "==", managerId));

    // 🔎 se tem pelo menos 3 letras, usa índice de prefixo
    if (searchPrefix) {
      clauses.push(where("searchPrefixes", "array-contains", searchPrefix));
    }

    // ordenar e paginar
    clauses.push(orderBy("createdAt", "desc"));
    clauses.push(limit(PAGE_SIZE));
    return query(ideasCol, ...clauses);
  }, [ideasCol, status, area, managerId, useSingleQuery, searchPrefix]);

  const buildMoreQuery = (after) => {
    const clauses = [];
    if (status) clauses.push(where("status", "==", status));
    if (area) clauses.push(where("area", "==", area));
    if (managerId) clauses.push(where("managerId", "==", managerId));
    clauses.push(orderBy("createdAt", "desc"));
    if (after) clauses.push(startAfter(after));
    clauses.push(limit(PAGE_SIZE));
    return query(ideasCol, ...clauses);
  };

  useEffect(() => {
    if (!useSingleQuery) return;
    setLoading(true);
    setLastDoc(null);
    setIdeas([]);
    const unsub = onSnapshot(
      baseQuery,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setIdeas(list);
        setHasMore(list.length === PAGE_SIZE);
        setLastDoc(snap.docs.at(-1) || null);
        setLoading(false);
      },
      (err) => {
        console.error("[IdeasList] onSnapshot error:", err?.message || err);
        setIdeas([]);
        setHasMore(false);
        setLastDoc(null);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [baseQuery, useSingleQuery]);

  async function loadMoreSingle() {
    if (!hasMore || loadingMore || !lastDoc) return 0;
    setLoadingMore(true);
    try {
      const qRef = buildMoreQuery(lastDoc);
      const snap = await getDocs(qRef);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setIdeas((prev) => uniqById([...prev, ...list]));
      setHasMore(list.length === PAGE_SIZE);
      setLastDoc(snap.docs.at(-1) || null);
      return list.length;
    } catch (err) {
      console.error("[IdeasList] loadMore error:", err?.code || err);
      return 0;
    } finally {
      setLoadingMore(false);
    }
  }

  // auto-load durante busca
  useEffect(() => {
    if (!useSingleQuery) return;
    if (!isSearchActive) return;
    let cancelled = false;

    const hasMatch = () =>
      ideasRef.current.some(i =>
        (!status || i.status === status) &&
        (!area || i.area === area) &&
        (!managerId || i.managerId === managerId) &&
        matches(i, termNorm)
      );

    async function run() {
      if (hasMatch()) return;
      let pages = 0;
      while (!cancelled && hasMore && pages < SEARCH_AUTOLOAD_LIMIT) {
        const added = await loadMoreSingle();
        pages += 1;
        if (added === 0) break;
        if (hasMatch()) break;
      }
    }

    run();
    return () => { cancelled = true; };
  }, [useSingleQuery, isSearchActive, termNorm, status, area, managerId, hasMore]);

  /* ===========================================================
   *  AGRUPADO (5 por status + expand/carreagar mais por status)
   * =========================================================== */
  const [groupData, setGroupData] = useState(() =>
    Object.fromEntries(STATUS_ORDER.map(s => [s, []]))
  );
  const [groupLastDoc, setGroupLastDoc] = useState(() =>
    Object.fromEntries(STATUS_ORDER.map(s => [s, null]))
  );
  const [groupHasMore, setGroupHasMore] = useState(() =>
    Object.fromEntries(STATUS_ORDER.map(s => [s, true]))
  );
  const [groupExpanded, setGroupExpanded] = useState(() =>
    Object.fromEntries(STATUS_ORDER.map(s => [s, false]))
  );
  const [groupLoadingMap, setGroupLoadingMap] = useState(() =>
    Object.fromEntries(STATUS_ORDER.map(s => [s, false]))
  );
  const [initialGroupsLoading, setInitialGroupsLoading] = useState(false);

  const useGrouped = !useSingleQuery;

  const buildGroupQuery = (statusValue, after, page = GROUP_FIRST) => {
    const clauses = [where("status", "==", statusValue)];
    if (area) clauses.push(where("area", "==", area));
    if (managerId) clauses.push(where("managerId", "==", managerId));
    clauses.push(orderBy("createdAt", "desc"));
    if (after) clauses.push(startAfter(after));
    clauses.push(limit(page));
    return query(ideasCol, ...clauses);
  };

  // reset + carregar 5 de cada status em paralelo
  useEffect(() => {
    if (!useGrouped) return;
    setLoading(true);
    setInitialGroupsLoading(true);
    setGroupData(Object.fromEntries(STATUS_ORDER.map(s => [s, []])));
    setGroupLastDoc(Object.fromEntries(STATUS_ORDER.map(s => [s, null])));
    setGroupHasMore(Object.fromEntries(STATUS_ORDER.map(s => [s, true])));
    setGroupExpanded(Object.fromEntries(STATUS_ORDER.map(s => [s, false])));
    setGroupLoadingMap(Object.fromEntries(STATUS_ORDER.map(s => [s, false])));

    (async () => {
      try {
        await Promise.all(
          STATUS_ORDER.map(async (s) => {
            const snap = await getDocs(buildGroupQuery(s, null, GROUP_FIRST));
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setGroupData(prev => ({ ...prev, [s]: list }));
            setGroupLastDoc(prev => ({ ...prev, [s]: snap.docs.at(-1) || null }));
            setGroupHasMore(prev => ({ ...prev, [s]: list.length === GROUP_FIRST }));
          })
        );
      } finally {
        setInitialGroupsLoading(false);
        setLoading(false);
      }
    })();
  }, [useGrouped, area, managerId]);

  async function loadMoreForGroup(s) {
    if (!useGrouped) return 0;
    if (groupLoadingMap[s]) return 0;
    setGroupLoadingMap(prev => ({ ...prev, [s]: true }));
    try {
      const snap = await getDocs(buildGroupQuery(s, groupLastDoc[s], GROUP_PAGE));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setGroupData(prev => ({ ...prev, [s]: uniqById([...prev[s], ...list]) }));
      setGroupLastDoc(prev => ({ ...prev, [s]: snap.docs.at(-1) || null }));
      setGroupHasMore(prev => ({ ...prev, [s]: list.length === GROUP_PAGE }));
      return list.length;
    } catch (e) {
      console.error("[IdeasList] loadMoreForGroup error:", e?.code || e);
      return 0;
    } finally {
      setGroupLoadingMap(prev => ({ ...prev, [s]: false }));
    }
  }

  function expandGroup(s) {
    setGroupExpanded(prev => ({ ...prev, [s]: true }));
    // se o grupo tem só os 5 iniciais e há mais no backend, já traz mais um lote
    if (groupHasMore[s] && (groupData[s]?.length || 0) <= GROUP_FIRST) {
      loadMoreForGroup(s);
    }
  }

  // itens atuais (p/ carregar coins)
  const currentItems = useMemo(() => {
    if (useSingleQuery) return ideas;
    return STATUS_ORDER.flatMap(s => groupData[s]);
  }, [useSingleQuery, ideas, groupData]);

  // carregar rewards das concluídas
  useEffect(() => {
    const pending = currentItems.filter(i => i.status === "concluida" && rewards[i.id] === undefined);
    if (pending.length === 0) return;

    let cancelled = false;
    (async () => {
      const snaps = await Promise.all(
        pending.map(i => getDoc(doc(db, "ideas", i.id, "rewards", "award")))
      );
      const patch = {};
      snaps.forEach((snap, idx) => {
        const ideaId = pending[idx].id;
        patch[ideaId] = snap.exists() ? (snap.data().amount || 0) : 0;
      });
      if (!cancelled) {
        setRewards(prev => ({ ...prev, ...patch }));
      }
    })();

    return () => { cancelled = true; };
  }, [currentItems, rewards]);

  // busca local (apenas no modo single)
  const filteredBase = useMemo(() => {
    if (!useSingleQuery) return ideas;
    if (!isSearchActive) return ideas;
    return ideas.filter(i =>
      (!status || i.status === status) &&
      (!area || i.area === area) &&
      (!managerId || i.managerId === managerId) &&
      matches(i, termNorm)
    );
  }, [ideas, useSingleQuery, isSearchActive, termNorm, status, area, managerId]);

  // reprovada no fim (modo single)
  const filtered = useMemo(() => {
    if (!useSingleQuery) return filteredBase;
    return filteredBase
      .slice()
      .sort((a, b) => {
        const ar = a.status === "reprovada" ? 1 : 0;
        const br = b.status === "reprovada" ? 1 : 0;
        if (ar !== br) return ar - br;
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
  }, [filteredBase, useSingleQuery]);

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Title order={3}>Ideias</Title>
        <Group>
          <Switch
            checked={groupByStatus}
            onChange={(e) => setGroupByStatus(e.currentTarget.checked)}
            label="Agrupar por status"
          />
          <Button component={Link} to="/ideias/nova">Nova ideia</Button>
        </Group>
      </Group>

      <Group align="end">
        <Select
          label="Status"
          placeholder="Todos"
          data={STATUS}
          value={status}
          onChange={setStatus}
          clearable
        />
        <Select
          label="Área"
          placeholder="Todas"
          data={AREAS}
          value={area}
          onChange={setArea}
          clearable
        />
        <Select
          label="Responsável"
          placeholder="Todos"
          searchable
          clearable
          data={committeeUsers.map(u => ({
            value: u.id,
            label: `${u.name}${u.email ? ` — ${u.email}` : ""}`,
          }))}
          value={managerId}
          onChange={setManagerId}
          style={{ minWidth: 260 }}
        />
        <TextInput
          label="Buscar (título/descrição)"
          placeholder="Ex.: dispositivo, ergonomia..."
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          style={{ flex: 1 }}
          rightSection={isSearchActive && loadingMore ? <Loader size="xs" /> : null}
        />
      </Group>

      {loading ? (
        <Group justify="center" mt="xl"><Loader /></Group>
      ) : useSingleQuery ? (
        // ===== LISTA PLANA =====
        filtered.length === 0 ? (
          <Card withBorder radius="md" p="lg">
            <Text c="dimmed">Nenhuma ideia encontrada com os filtros atuais.</Text>
          </Card>
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {filtered.map((i) => (
                <IdeaCard
                  key={i.id}
                  idea={i}
                  rewardAmount={i.status === "concluida" ? (rewards[i.id] ?? 0) : 0}
                />
              ))}
            </SimpleGrid>

            {hasMore && (
              <Group justify="center" mt="md">
                <Button variant="light" onClick={loadMoreSingle} loading={loadingMore}>
                  Carregar mais
                </Button>
              </Group>
            )}
          </>
        )
      ) : (
        // ===== AGRUPADO: 5 por status + expand/carreagar mais por status =====
        <>
          {initialGroupsLoading ? (
            <Group justify="center" mt="xl"><Loader /></Group>
          ) : (
            STATUS_ORDER.map((s) => {
              const items = groupData[s] || [];
              if (items.length === 0) return null;

              const expanded = groupExpanded[s];
              const visible = expanded ? items : items.slice(0, GROUP_FIRST);

              return (
                <Stack key={s}>
                  <Group justify="space-between" align="center" mt="sm">
                    <Group gap="xs">
                      <Badge size="sm" variant="light">{statusLabel(s)}</Badge>
                      <Text c="dimmed" size="sm">{items.length} itens</Text>
                    </Group>

                    {!expanded && (
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => expandGroup(s)}
                      >
                        Ver mais
                      </Button>
                    )}
                  </Group>

                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                    {visible.map((i) => (
                      <IdeaCard
                        key={i.id}
                        idea={i}
                        rewardAmount={i.status === "concluida" ? (rewards[i.id] ?? 0) : 0}
                      />
                    ))}
                  </SimpleGrid>

                  {expanded && groupHasMore[s] && (
                    <Group justify="center" mt="xs">
                      <Button
                        variant="light"
                        onClick={() => loadMoreForGroup(s)}
                        loading={groupLoadingMap[s]}
                      >
                        Carregar mais {statusLabel(s)}
                      </Button>
                    </Group>
                  )}

                  <Divider />
                </Stack>
              );
            })
          )}
        </>
      )}
    </Stack>
  );
}

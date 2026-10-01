import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const cache = {};

export function useMaster(name) {
  const [items, setItems] = useState(cache[name] || []);
  const [loading, setLoading] = useState(!cache[name]);
  useEffect(() => {
    let active = true;
    api
      .get(`/master/${name}`)
      .then(({ data }) => {
        if (!active) return;
        cache[name] = data;
        setItems(data);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [name]);
  return { items, loading };
}

export function clearMasterCache() {
  Object.keys(cache).forEach((k) => delete cache[k]);
}

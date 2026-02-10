/**
 * Sélecteur de pays aligné sur GesFlow (web) : utilise la librairie world-countries
 * pour la liste (jamais vide) et l’API pour le mapping code <-> countryId.
 */
import React, { useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import countries from "world-countries";
import api from "@/config/api";
import { useTheme } from "@/contexts/ThemeContext";
import { Select } from "@/components/ui/Select";

export interface CountrySelectProps {
  value?: string; // countryId
  onValueChange: (countryId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Pays de la DB pour le mapping id <-> code (optionnel, sinon appel API) */
  dbCountries?: Array<{ id: string; code: string; name: string }>;
}

const formattedCountries = countries
  .map((c) => ({
    code: c.cca2,
    name: c.name.common,
    nameFr: (c as { translations?: { fra?: { common?: string } } }).translations?.fra?.common ?? c.name.common,
  }))
  .sort((a, b) => a.nameFr.localeCompare(b.nameFr, "fr"));

export function CountrySelect({
  value: countryId,
  onValueChange,
  label,
  placeholder = "Sélectionner un pays",
  required = false,
  disabled = false,
  dbCountries = [],
}: CountrySelectProps) {
  const { isDark } = useTheme();
  const [isResolving, setIsResolving] = useState(false);
  // Garder le dernier code sélectionné par id (pour afficher tout de suite avant que dbCountries soit à jour)
  const lastCodeByIdRef = useRef<Record<string, string>>({});

  const codeFromId = useMemo(() => {
    if (!countryId) return "";
    const fromDb = dbCountries.find((x) => x.id === countryId);
    if (fromDb) return fromDb.code;
    return lastCodeByIdRef.current[countryId] ?? "";
  }, [countryId, dbCountries]);

  const options = useMemo(
    () =>
      formattedCountries.map((c) => ({
        label: c.nameFr,
        value: c.code,
      })),
    []
  );

  const handleChange = async (selectedCode: string) => {
    let idToEmit = selectedCode;

    const fromDb = dbCountries.find((c) => c.code === selectedCode);
    if (fromDb) {
      idToEmit = fromDb.id;
    } else {
      setIsResolving(true);
      try {
        const countryData = formattedCountries.find((c) => c.code === selectedCode);
        if (countryData) {
          const { data } = await api.post("/api/countries", {
            name: countryData.nameFr,
            code: selectedCode,
          });
          if (data?.id) idToEmit = data.id;
        }
      } catch {
        // en cas d’erreur on envoie le code, le backend pourra gérer
      } finally {
        setIsResolving(false);
      }
    }

    lastCodeByIdRef.current[idToEmit] = selectedCode;
    onValueChange(idToEmit);
  };

  return (
    <View>
      {label && (
        <Text
          className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"} ${disabled ? "opacity-50" : ""}`}
        >
          {label} {required ? <Text className="text-red-500">*</Text> : null}
        </Text>
      )}
      <Select
        value={codeFromId}
        onValueChange={handleChange}
        placeholder={
          isResolving ? "Création du pays..." : placeholder
        }
        options={options}
        disabled={disabled || isResolving}
      />
    </View>
  );
}

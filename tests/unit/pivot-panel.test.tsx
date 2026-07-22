/**
 * Tests for the interactive pivot panel: the pure spec-mutation helpers (the
 * real logic) and a jsdom render asserting the field chips + drop areas exist
 * and that dropping / removing a field fires onChange with the right spec.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// The @untitledui/icons ESM barrel re-exports extensionless paths that Node's
// ESM resolver (used by vitest) can't resolve. The panel only needs a tiny icon
// glyph, so stub the package with a trivial component — keeps the test focused
// on behavior, not the icon set.
vi.mock("@untitledui/icons", () => ({
  X: (props: Record<string, unknown>) => <span data-icon="x" {...props} />,
}));
import {
  PivotPanel,
  areaOfField,
  fieldsInArea,
  placeField,
  removeField,
  setValueAggregate,
  aggregateOfValue,
} from "../../src/features/pivot-panel";
import type { PivotSpec } from "../../src/core/types";

const baseSpec: PivotSpec = {
  rows: ["Region"],
  columns: [],
  values: [{ field: "Amount", aggregate: "sum" }],
};

describe("pivot-panel spec helpers", () => {
  it("reports the fields in each area", () => {
    const spec: PivotSpec = { rows: ["Region"], columns: ["Quarter"], values: [{ field: "Amount", aggregate: "sum" }], filters: [{ field: "Year" }] };
    expect(fieldsInArea(spec, "rows")).toEqual(["Region"]);
    expect(fieldsInArea(spec, "columns")).toEqual(["Quarter"]);
    expect(fieldsInArea(spec, "values")).toEqual(["Amount"]);
    expect(fieldsInArea(spec, "filters")).toEqual(["Year"]);
  });

  it("finds the area a field is placed in", () => {
    expect(areaOfField(baseSpec, "Region")).toBe("rows");
    expect(areaOfField(baseSpec, "Amount")).toBe("values");
    expect(areaOfField(baseSpec, "Nope")).toBeNull();
  });

  it("places a field into an area (and removes it from its old one)", () => {
    const next = placeField(baseSpec, "Region", "columns");
    expect(next.rows).toEqual([]);
    expect(next.columns).toEqual(["Region"]);
  });

  it("defaults a fresh Values field to sum, preserving an existing aggregate on move", () => {
    const added = placeField(baseSpec, "Units", "values");
    expect(added.values.find((v) => v.field === "Units")?.aggregate).toBe("sum");

    const withAvg = setValueAggregate(added, "Units", "average");
    // Reordering within Values keeps the average aggregate.
    const reordered = placeField(withAvg, "Units", "values", 0);
    expect(reordered.values[0].field).toBe("Units");
    expect(aggregateOfValue(reordered, "Units")).toBe("average");
  });

  it("reorders within an area by index", () => {
    const spec: PivotSpec = { rows: ["A", "B", "C"], columns: [], values: [] };
    const moved = placeField(spec, "C", "rows", 0);
    expect(moved.rows).toEqual(["C", "A", "B"]);
  });

  it("removes a field from every area", () => {
    expect(removeField(baseSpec, "Region").rows).toEqual([]);
    expect(removeField(baseSpec, "Amount").values).toEqual([]);
  });

  it("changes a value field's aggregate", () => {
    const next = setValueAggregate(baseSpec, "Amount", "count");
    expect(next.values[0].aggregate).toBe("count");
  });
});

describe("<PivotPanel />", () => {
  const fields = ["Region", "Quarter", "Amount"];

  it("renders the field chips and the four drop areas", () => {
    render(<PivotPanel fields={fields} spec={baseSpec} onChange={() => {}} />);
    for (const f of fields) expect(screen.getByTestId(`field-chip-${f}`)).toBeTruthy();
    for (const a of ["filters", "columns", "rows", "values"]) expect(screen.getByTestId(`area-${a}`)).toBeTruthy();
  });

  it("fires onChange with a placed field when one is dropped into an area", () => {
    const onChange = vi.fn();
    render(<PivotPanel fields={fields} spec={baseSpec} onChange={onChange} />);

    // Simulate an HTML5 drop of "Quarter" onto the Columns area.
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: (k: string, v: string) => data.set(k, v),
      getData: (k: string) => data.get(k) ?? "",
    };
    fireEvent.dragStart(screen.getByTestId("field-chip-Quarter"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("area-columns"), { dataTransfer });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].columns).toEqual(["Quarter"]);
  });

  it("fires onChange removing a field when its chip × is clicked", () => {
    const onChange = vi.fn();
    render(<PivotPanel fields={fields} spec={baseSpec} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Remove Region"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].rows).toEqual([]);
  });

  it("changes the aggregate when the Values dropdown changes", () => {
    const onChange = vi.fn();
    render(<PivotPanel fields={fields} spec={baseSpec} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Aggregate for Amount"), { target: { value: "average" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].values[0].aggregate).toBe("average");
  });
});

"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/registry/shared";
import { createCompanyAction } from "./actions";

export function AddCompanyForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [tin, setTin] = useState("");
  const [sector, setSector] = useState("Manufacturing & Engineering");
  const [type, setType] = useState<"Public Limited" | "Private Limited">("Public Limited");
  const [listed, setListed] = useState(true);
  const [paidUpCapital, setPaidUpCapital] = useState("500000000");
  const [totalShareholders, setTotalShareholders] = useState("4500");
  const [shareClasses, setShareClasses] = useState("Ordinary");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createCompanyAction({
        name,
        shortName,
        registrationNo,
        tin,
        sector,
        type,
        listed,
        paidUpCapital,
        totalShareholders,
        shareClasses,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Company onboarded into workspace");
      setOpen(false);
      setName("");
      setShortName("");
      setRegistrationNo("");
      setTin("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-9 gap-1.5" />}>
        <Plus className="h-4 w-4" aria-hidden />
        Add company
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand" />
            Onboard legal entity
          </DialogTitle>
          <DialogDescription>
            Register a subsidiary or listed company with its RJSC incorporation details and share classes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Legal company name" htmlFor="co-name">
              <Input id="co-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Jamuna Maritime PLC" />
            </Field>
            <Field label="Short name" htmlFor="co-short">
              <Input id="co-short" value={shortName} onChange={(e) => setShortName(e.target.value)} required placeholder="e.g. Jamuna Maritime" />
            </Field>
            <Field label="RJSC Registration No." htmlFor="co-reg">
              <Input id="co-reg" value={registrationNo} onChange={(e) => setRegistrationNo(e.target.value)} required placeholder="C-184920/2024" />
            </Field>
            <Field label="Company TIN" htmlFor="co-tin">
              <Input id="co-tin" value={tin} onChange={(e) => setTin(e.target.value)} required placeholder="100849201-0201" />
            </Field>
            <Field label="Industry sector" htmlFor="co-sector">
              <Input id="co-sector" value={sector} onChange={(e) => setSector(e.target.value)} required />
            </Field>
            <Field label="Entity type" htmlFor="co-type">
              <NativeSelect id="co-type" value={type} onChange={(e) => setType(e.target.value as "Public Limited" | "Private Limited")}>
                <option value="Public Limited">Public Limited</option>
                <option value="Private Limited">Private Limited</option>
              </NativeSelect>
            </Field>
            <Field label="Paid-up capital (BDT)" htmlFor="co-cap">
              <Input id="co-cap" type="number" min={100000} value={paidUpCapital} onChange={(e) => setPaidUpCapital(e.target.value)} required />
            </Field>
            <Field label="Shareholder count" htmlFor="co-holders">
              <Input id="co-holders" type="number" min={1} value={totalShareholders} onChange={(e) => setTotalShareholders(e.target.value)} required />
            </Field>
          </div>

          <Field label="Share classes (comma-separated)" htmlFor="co-classes">
            <Input id="co-classes" value={shareClasses} onChange={(e) => setShareClasses(e.target.value)} required placeholder="Ordinary, Preference" />
          </Field>

          <label className="flex items-center gap-2 pt-1 text-xs text-foreground">
            <Checkbox checked={listed} onCheckedChange={(v) => setListed(Boolean(v))} />
            <span>Listed on Dhaka / Chattogram Stock Exchange (DSE / CSE)</span>
          </label>

          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>Onboard company</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

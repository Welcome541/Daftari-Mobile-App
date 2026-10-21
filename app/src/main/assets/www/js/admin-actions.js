/* Administrative UI: show success/close forms only after the committed result. */
async function adminUndo(change) {
  try {
    await change.undo();
    render();
  } catch (e) {
    toastMsg(
      db.lang === "ar"
        ? "تعذّر التراجع: تغيّرت البيانات أو فشل الحفظ."
        : "Undo failed: data changed or storage failed.",
    );
  }
}
async function switchAcc(id) {
  try {
    await LedgerEdits.commit((_, draft) => {
      if (!draft.data[id]) throw new Error("missing-account");
      draft.active = id;
    });
    closeSheet();
    stack = [{ s: "home" }];
    render();
  } catch (e) {
    storageFailure();
  }
}
async function saveAccEdit() {
  const nm = (document.getElementById("aeNm").value || "").trim();
  if (!nm) {
    toastMsg(t("nameReq"));
    return;
  }
  const cur = document.getElementById("aeCur").value,
    edit = ui.accEdit,
    type = ui.accTy;
  try {
    await LedgerEdits.commit((_, draft) => {
      if (edit === "new") {
        const id = uid();
        draft.accounts.push({ id, name: nm, type, cur, minorUnit: 2 });
        draft.data[id] = { customers: [], invoices: [], payments: [], seq: 1 };
        draft.active = id;
      } else {
        const a = draft.accounts.find((a) => a.id === edit);
        if (!a) throw new Error("missing-account");
        a.name = nm;
        a.cur = cur;
        a.type = type;
      }
    });
    ui.accEdit = null;
    closeSheet();
    stack = [{ s: "home" }];
    render();
    toastMsg(t("savedName"));
  } catch (e) {
    storageFailure();
  }
}
async function setCur(value) {
  if (!value) return;
  try {
    await LedgerEdits.commit((_, draft) => {
      draft.accounts.find((a) => a.id === draft.active).cur = value;
    });
    closeSheet();
    render();
  } catch (e) {
    storageFailure();
  }
}
async function saveCur() {
  const value = (document.getElementById("curIn").value || "").trim();
  if (value) await setCur(value);
}
async function setLang(lang) {
  try {
    await LedgerEdits.commit((_, draft) => {
      draft.lang = lang;
    });
    applyLang();
    render();
  } catch (e) {
    storageFailure();
  }
}
async function setCustomerArchived(id, archived) {
  try {
    await LedgerAdmin.customer(db.active, id, { archived });
    closeSheet();
    if (archived) stack = [{ s: "customers" }];
    render();
    toastMsg(t(archived ? "archived" : "restore"));
  } catch (e) {
    storageFailure();
  }
}
async function togglePin(id) {
  try {
    const c = cust(id);
    if (!c) return;
    await LedgerAdmin.customer(db.active, id, { pinned: !c.pinned });
    closeSheet();
    render();
  } catch (e) {
    storageFailure();
  }
}
async function cselPin() {
  if (!ui.csel || ui.csel.ids.length !== 1) return;
  try {
    const id = ui.csel.ids[0],
      c = cust(id);
    if (!c) return;
    const pinned = !c.pinned;
    await LedgerAdmin.customer(db.active, id, { pinned });
    ui.csel = { on: false, ids: [] };
    render();
    toastMsg(t(pinned ? "pinAct" : "unpinAct") + " ✓");
  } catch (e) {
    storageFailure();
  }
}
async function cselDelete() {
  if (!ui.csel || !ui.csel.ids.length) {
    toastMsg(t("selEmpty"));
    return;
  }
  try {
    const change = await LedgerAdmin.remove(
      db.active,
      ui.csel.ids.map((id) => "c:" + id),
    );
    ui.csel = { on: false, ids: [] };
    render();
    toastMsg(t("deletedN")(change.value) + " · " + t("trashT"), () =>
      adminUndo(change),
    );
  } catch (e) {
    storageFailure();
  }
}
async function selDelete() {
  if (!ui.sel || !ui.sel.on || !ui.sel.ids.length) {
    toastMsg(t("selEmpty"));
    return;
  }
  try {
    const change = await LedgerAdmin.remove(db.active, ui.sel.ids);
    ui.sel = { on: false, ids: [] };
    render();
    toastMsg(t("deletedN")(change.value) + " · " + t("trashT"), () =>
      adminUndo(change),
    );
  } catch (e) {
    storageFailure();
  }
}
async function selArchive() {
  if (!ui.sel || !ui.sel.on || !ui.sel.ids.length) {
    toastMsg(t("selEmpty"));
    return;
  }
  try {
    const change = await LedgerAdmin.archive(db.active, ui.sel.ids);
    ui.sel = { on: false, ids: [] };
    render();
    toastMsg(t("txArchived")(change.value), () => adminUndo(change));
  } catch (e) {
    storageFailure();
  }
}
async function trashRestore(id) {
  try {
    await LedgerAdmin.restore(db.active, id);
    render();
    toastMsg(t("restore") + " ✓");
  } catch (e) {
    storageFailure();
  }
}
async function trashPurge() {
  if (!confirm(t("emptyTrashQ"))) return;
  try {
    const result = await LedgerAdmin.purge(db.active);
    render();
    if (result.value.retained)
      toastMsg(
        db.lang === "ar"
          ? "تم الاحتفاظ بعناصر مرتبطة بحركات موجودة."
          : "Items referenced by existing transactions were retained.",
      );
  } catch (e) {
    storageFailure();
  }
}

let photoGeneration = 0;
function photoContext(target) {
  return {
    target,
    account: db.active,
    form: ui.nc,
    route: JSON.stringify(stack),
    generation: ++photoGeneration,
    previous: target === "nc" ? ui.nc.photo : (cust(target) || {}).photo,
  };
}
function photoCurrent(context) {
  return (
    !locked &&
    context.generation === photoGeneration &&
    db.active === context.account &&
    JSON.stringify(stack) === context.route &&
    (context.target !== "nc" || ui.nc === context.form)
  );
}
async function applyCustomerPhoto(context, url) {
  if (!photoCurrent(context)) return false;
  if (context.target === "nc") {
    ui.nc.photo = url;
    return true;
  }
  await LedgerEdits.commit((_, draft) => {
    if (!photoCurrent(context)) throw new Error("stale-photo");
    const c = draft.data[context.account].customers.find(
      (x) => x.id === context.target,
    );
    if (!c || c.photo !== context.previous) throw new Error("stale-photo");
    c.photo = url;
  });
  return true;
}
function pickPhoto(target) {
  const context = photoContext(target),
    input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file || !photoCurrent(context)) return;
    if (file.size > 8 * 1024 * 1024) {
      toastMsg("⚠ image-too-large");
      return;
    }
    const image = new Image(),
      url = URL.createObjectURL(file);
    image.onerror = () => {
      URL.revokeObjectURL(url);
      if (photoCurrent(context)) toastMsg(t("btFail"));
    };
    image.onload = async () => {
      URL.revokeObjectURL(url);
      if (!photoCurrent(context)) return;
      try {
        if (
          !image.width ||
          !image.height ||
          image.width * image.height > 32000000
        )
          throw new Error("image-too-large");
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 96;
        const size = Math.min(image.width, image.height);
        canvas
          .getContext("2d")
          .drawImage(
            image,
            (image.width - size) / 2,
            (image.height - size) / 2,
            size,
            size,
            0,
            0,
            96,
            96,
          );
        if (
          await applyCustomerPhoto(
            context,
            canvas.toDataURL("image/jpeg", 0.82),
          )
        ) {
          closeSheet();
          render();
        }
      } catch (e) {
        storageFailure();
      }
    };
    image.src = url;
  };
  input.click();
}
async function removePhoto(target) {
  const context = photoContext(target);
  try {
    if (await applyCustomerPhoto(context, null)) {
      closeSheet();
      render();
    }
  } catch (e) {
    storageFailure();
  }
}

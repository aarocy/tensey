<img width="1360" height="644" alt="image" src="https://github.com/user-attachments/assets/484c7556-e5ae-4c56-b7d5-74b2a72e55dd" />

# tensey

neural network design that doesn't suck.

## what it does

you draw a graph. tensey tells you if it's broken before you waste 8 hours training. shapes propagate automatically. params, flops, vram estimates show up live. export to pytorch when you're done.

## why

professors draw boxes on whiteboards and lie about the math. students nod and guess. tensey makes the math visible. no more "i think the shapes work out." you know.

## setup

```bash
git clone https://github.com/[you]/tensey
cd tensey/packages/web
pnpm install
pnpm dev
```

open http://localhost:5173. drag layers from the left. watch shapes flow. click nodes to edit params. right-click to delete/duplicate/copy. ctrl+z to undo your mistakes.

## export

generate valid pytorch code. `File > Export PyTorch`. copy-paste into your training script. it runs.

## what it supports

63 ops. conv, linear, attention, norm, pooling, lstm, all that. add your own in the operator registry. shape inference handles dynamic batch dims.

## why not

- no GPU integration. tensey estimates cost, doesn't run it.
- no collaboration yet. solo architect only.
- no framework lock. pytorch export is the only one right now.

## license

MIT. steal it. improve it. ship it.

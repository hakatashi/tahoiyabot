# tahoiyabot
AIにたほいやをする仕事を奪われる人

```sh
git clone --recursive https://github.com/hakatashi/tahoiyabot.git
cd tahoiyabot
wget https://dumps.wikimedia.org/jawiki/20181220/jawiki-20181220-pages-meta-current.xml.bz2
node generate-dataset.js jawiki-20181220-pages-meta-current.xml.bz2
shuf entries.tsv > entries.scrambled.tsv
cut -f2 < entries.scrambled.tsv | sed 's/./& /g' > entries.src.txt
cut -f3 < entries.scrambled.tsv > entries.dst.txt
mecab -Owakati < entries.dst.txt > entries.dst.tok.txt
./subword-nmt/subword_nmt/learn_bpe.py -s 32000 < entries.dst.tok.txt > entries.dst.tok.bpe.32000.bpe.txt
./subword-nmt/subword_nmt/apply_bpe.py -c entries.dst.tok.bpe.32000.bpe.txt < entries.dst.tok.txt > entries.dst.tok.bpe.32000.txt
./seq2seq/bin/tools/generate_vocab.py < entries.dst.tok.bpe.32000.txt | grep -vw UNK > entries.dst.tok.bpe.32000.vocab.txt
./seq2seq/bin/tools/generate_vocab.py < entries.src.txt > entries.src.vocab.txt
head -n -3000 entries.src.txt > train.src.txt
tail -n 3000 entries.src.txt > dev.src.txt
head -n -3000 entries.dst.tok.bpe.32000.txt > train.dst.tok.bpe.32000.txt
tail -n 3000 entries.dst.tok.bpe.32000.txt > dev.dst.tok.bpe.32000.txt
```

```
./subword-nmt/subword_nmt/learn_bpe.py -s 8000 < entries.dst.tok.txt > entries.dst.tok.bpe.8000.bpe.txt
./subword-nmt/subword_nmt/apply_bpe.py -c entries.dst.tok.bpe.8000.bpe.txt < entries.dst.tok.txt > entries.dst.tok.bpe.8000.txt
./seq2seq/bin/tools/generate_vocab.py < entries.dst.tok.bpe.8000.txt | grep -vw UNK > entries.dst.tok.bpe.8000.vocab.txt
head -n -3000 entries.dst.tok.bpe.8000.txt > train.dst.tok.bpe.8000.txt
tail -n 3000 entries.dst.tok.bpe.8000.txt > dev.dst.tok.bpe.8000.txt
```

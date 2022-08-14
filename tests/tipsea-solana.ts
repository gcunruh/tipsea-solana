import * as anchor from '@project-serum/anchor'
import { Program, Wallet } from '@project-serum/anchor'
import { TipseaSolana } from '../target/types/tipsea_solana'
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, createInitializeMintInstruction, MINT_SIZE } from '@solana/spl-token' // IGNORE THESE ERRORS IF ANY
const { SystemProgram } = anchor.web3
import { PublicKey } from '@solana/web3.js';

let newMintKey: any;

describe('tipsea-nft', () => {
  // Configure the client to use the correct cluster.
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet as Wallet;
  anchor.setProvider(provider);
  const program = anchor.workspace.TipseaSolana as Program<TipseaSolana>

  it("what is id", async () => {
    console.log(program.programId);
  })

  it("mint nft", async () => {
    // Add your test here.

    const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
      "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
    );
    const lamports: number =
      await program.provider.connection.getMinimumBalanceForRentExemption(
        MINT_SIZE
      );
    const getMetadata = async (
      mint: anchor.web3.PublicKey
    ): Promise<anchor.web3.PublicKey> => {
      return (
        await anchor.web3.PublicKey.findProgramAddress(
          [
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
          ],
          TOKEN_METADATA_PROGRAM_ID
        )
      )[0];
    };

    const getMasterEdition = async (
      mint: anchor.web3.PublicKey
    ): Promise<anchor.web3.PublicKey> => {
      return (
        await anchor.web3.PublicKey.findProgramAddress(
          [
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
            Buffer.from("edition"),
          ],
          TOKEN_METADATA_PROGRAM_ID
        )
      )[0];
    };

    const mintKey: anchor.web3.Keypair = anchor.web3.Keypair.generate();
    const NftTokenAccount = await getAssociatedTokenAddress(
      mintKey.publicKey,
      wallet.publicKey
    );
    console.log("NFT Account: ", NftTokenAccount.toBase58());

    const mint_tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKey.publicKey,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
        lamports,
      }),
      createInitializeMintInstruction(
        mintKey.publicKey,
        0,
        wallet.publicKey,
        wallet.publicKey
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        NftTokenAccount,
        wallet.publicKey,
        mintKey.publicKey
      )
    );

    const res = await program.provider.sendAndConfirm(mint_tx, [mintKey]);
    console.log(
      await program.provider.connection.getParsedAccountInfo(mintKey.publicKey)
    );

    console.log("Account: ", res);
    console.log("Mint key: ", mintKey.publicKey.toString());
    console.log("User: ", wallet.publicKey.toString());

    const metadataAddress = await getMetadata(mintKey.publicKey);
    const masterEdition = await getMasterEdition(mintKey.publicKey);

    console.log("Metadata address: ", metadataAddress.toBase58());
    console.log("MasterEdition: ", masterEdition.toBase58());

    const tx = await program.methods.mintNft(
      "https://tipsea.s3.us-west-2.amazonaws.com/metadata/test_metadata.json",
      "Martini",
      "MARTINI",
    )
      .accounts({
        mintAuthority: wallet.publicKey,
        mint: mintKey.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        metadata: metadataAddress,
        tokenAccount: NftTokenAccount,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        payer: wallet.publicKey,
        creator: new PublicKey("AAXzaxthXQTW6jnN7xJGVNiUeGqpDezMvqpMCd75D1nZ"),
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        masterEdition: masterEdition,
      },
      )
      .rpc();
    newMintKey = mintKey.publicKey;
    console.log("Your transaction signature", tx);
  });

  it('send nft', async() => {

    const fromAta = await getAssociatedTokenAddress(
      newMintKey,
      wallet.publicKey
    )

    const toAta = await getAssociatedTokenAddress(
        newMintKey, // mint
        new PublicKey("AAXzaxthXQTW6jnN7xJGVNiUeGqpDezMvqpMCd75D1nZ") // owner
    );

    console.log(`New Mint Key: ${newMintKey}`);
    console.log(`fromAta: ${fromAta}`);
    console.log(`toAta: ${toAta}`);


    const mint_tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey, toAta, new PublicKey("AAXzaxthXQTW6jnN7xJGVNiUeGqpDezMvqpMCd75D1nZ"), newMintKey
      )
    )

    await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, []);

    console.log(`toAta: ${mint_tx}`);

    await program.methods.sendNft().accounts({
      sender: wallet.publicKey,
      from: fromAta,
      receiver: toAta,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    }).rpc()

  })


});
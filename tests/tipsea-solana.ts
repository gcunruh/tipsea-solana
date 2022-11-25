import * as anchor from '@project-serum/anchor';
import { Program, Wallet } from '@project-serum/anchor';
import { TipseaSolana } from '../target/types/tipsea_solana';
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, createInitializeMintInstruction, MINT_SIZE, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
const { SystemProgram } = anchor.web3;
import { PROGRAM_ADDRESS } from '@metaplex-foundation/mpl-token-metadata';
import { PublicKey, Keypair } from '@solana/web3.js';

const provider = anchor.AnchorProvider.env();
anchor.setProvider( provider );
const program = anchor.workspace.TipseaSolana as Program<TipseaSolana>;
const programId = program.programId;
const wallet = provider.wallet as Wallet;
const to_pk = [] as number[]; // fill in 
const to_wallet = Keypair.fromSecretKey(
  Uint8Array.from( to_pk )
);

const HERA_USDC_MINT = new PublicKey( "5kU3fkzBcmpirSbjDY99QqQ3Zq8ABks1JMzZxAVx16Da" );
const TOKEN_METADATA_PROGRAM_ID = new PublicKey( PROGRAM_ADDRESS );
const TIPSEA = new PublicKey("8a2z19H17vyQ89rmtR5tATWkGFutJ5gBWre2fthXimHa");

describe( 'tipsea-nft', async () =>
{
  const getMetadata = async (
    mint: anchor.web3.PublicKey
  ): Promise<anchor.web3.PublicKey> =>
  {
    return (
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from( "metadata" ),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )
    )[ 0 ];
  };

  const getMasterEdition = async (
    mint: anchor.web3.PublicKey
  ): Promise<anchor.web3.PublicKey> =>
  {
    return (
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from( "metadata" ),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
          Buffer.from( "edition" ),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )
    )[ 0 ];
  };

  const fundSeeds = [
    Buffer.from( "fund" ),
    wallet.publicKey.toBuffer()
  ];

  const [ fundPda, _fundBump ] = await anchor.web3.PublicKey
    .findProgramAddress(
      fundSeeds,
      programId,
    );

  const fromAta = await getAssociatedTokenAddress(
    HERA_USDC_MINT,
    provider.wallet.publicKey,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const toAta = await getAssociatedTokenAddress(
    HERA_USDC_MINT,
    to_wallet.publicKey,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const mintKey: anchor.web3.Keypair = anchor.web3.Keypair.generate();

  const NftTokenAccount = await getAssociatedTokenAddress(
    mintKey.publicKey,
    to_wallet.publicKey
  );

  // it("initialize tipsea", async() => {
  //   console.log("Initializing...");
  //   let tx = new anchor.web3.Transaction();

  //   tx.add(
  //     await program.methods
  //       .initializeTipsea()
  //       .accounts({
  //         initializer: provider.wallet.publicKey,
  //         fund: fundPda,
  //         mint: HERA_USDC_MINT
  //       })
  //       .instruction()
  //   );

  //   await provider.sendAndConfirm(tx);
  //   console.log("Initialized!");
  // })

  it( "mint nft", async () =>
  {

    const lamports: number =
      await program.provider.connection.getMinimumBalanceForRentExemption(
        MINT_SIZE
      );

    const mint_tx = new anchor.web3.Transaction();

    mint_tx.add(
      anchor.web3.SystemProgram.createAccount( {
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKey.publicKey,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
        lamports,
      } ),
      createInitializeMintInstruction(
        mintKey.publicKey,
        0,
        wallet.publicKey,
        wallet.publicKey
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        NftTokenAccount,
        to_wallet.publicKey,
        mintKey.publicKey
      )
    );

    const res = await program.provider.sendAndConfirm(mint_tx, [mintKey]);

    const metadataAddress = await getMetadata( mintKey.publicKey );
    const masterEdition = await getMasterEdition( mintKey.publicKey );

    console.log( "Account: ", res );
    console.log( "Mint key: ", mintKey.publicKey.toString() );
    console.log( "ATA: ", NftTokenAccount.toBase58() );
    console.log( "Metadata address: ", metadataAddress.toBase58() );
    console.log( "MasterEdition: ", masterEdition.toBase58() );

    let tx = new anchor.web3.Transaction();

    tx.add( 
      await program.methods.createTipsea(
        "https://tipsea.s3.us-west-2.amazonaws.com/metadata/test_metadata.json",
        "Martini",
        "MAR",
        TIPSEA
      )
        .accounts( {
          mintAuthority: wallet.publicKey,
          mint: mintKey.publicKey,
          tokenAccount: NftTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          metadata: metadataAddress,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          payer: wallet.publicKey,
          fromAccount: fromAta,
          fund: fundPda,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          masterEdition: masterEdition,
        },
        ).instruction());

    const final = await program.provider.sendAndConfirm(tx);

    console.log( "Done!", final );
  } );

  // it( "redeem", async () =>
  // {
  //   console.log( "Redeeming..." );
  //   let tx = new anchor.web3.Transaction();

  //   tx.add(
  //     await program.methods
  //       .redeem()
  //       .accounts( {
  //         signer: to_wallet.publicKey,
  //         toAccount: toAta,
  //         fund: fundPda,
  //         mint: HERA_USDC_MINT,
  //         tokenAccount: NftTokenAccount,
  //         metadataAccount: metadataAddress,
  //         tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //         systemProgram: SystemProgram.programId,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //       } )
  //       .instruction()
  //   );

  //   await provider.sendAndConfirm( tx );
  //   console.log( "Success!", tx );
  // } );


} );
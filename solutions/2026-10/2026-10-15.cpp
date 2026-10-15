#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const int N=2e3;
int dp1[N+5],dp2[N+5];
int sg(int x){
    if(x<=0) return 0;
    int y=sqrt(x);
    if(y*y==x&&dp1[y]!=-1) return dp1[y];
    else if(y*y!=x&&dp2[y]!=-1) return dp2[y];
    vector<int>vis(y+1);
    for(int k=(y*y==x?1:0);k<=y;k++) {
        int cur=sg((y-k)*y);
        if(cur>y) continue;
        vis[cur]++;
    }
    int mex=0;
    for(int j=0;j<=y;j++){
        if(vis[j]) mex++; 
        else break;
    }
    if(y*y==x) return dp1[y]=mex;
    return dp2[y]=mex;
}
void solve(){
    int n;cin>>n;
    int f=0,x;
    for(int i=1;i<=n;i++){
        cin>>x;
        f^=sg(x);
    }
    if(f) cout<<"First"<<endl;
    else cout<<"Second"<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    memset(dp1,-1,sizeof dp1);
    memset(dp2,-1,sizeof dp2);
    int T=1;//cin>>T
    while(T--) solve();
    return 0;
}